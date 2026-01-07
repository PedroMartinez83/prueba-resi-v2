import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  TrendingUp, 
  Calculator,
  User,
  Calendar,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import adminService from '../services/adminService';
import CalculadoraInversion from './inversiones/CalculadoraInversion';
import ModalInversionistas from './inversiones/ModalInversionistas';
import VincularInversionistaModal from './inversiones/VincularInversionistaModal';


const VehicleInvestmentPanel = ({ vehiculo, onAsignarInversionClick }) => {
  const navigate = useNavigate();
  const [inversion, setInversion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [showModalInversionista, setShowModalInversionista] = useState(false);
  const [datosCalculados, setDatosCalculados] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);
  const [showVincularModal, setShowVincularModal] = useState(false);

  useEffect(() => {
    if (vehiculo?.NumeroSerie) {
      cargarInversion();
    }
  }, [vehiculo]);

  const cargarInversion = async () => {
    try {
      setLoading(true);
      const response = await adminService.getInversionesByVehiculo(vehiculo.NumeroSerie);
      
      if (response.success && response.inversiones?.length > 0) {
        setInversion(response.inversiones[0]);
      } else {
        setInversion(null);
      }
    } catch (error) {
      console.error('Error cargando inversión:', error);
      setInversion(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculosCompletados = (resultado) => {
    if (resultado?.usarDatos) {
      setDatosCalculados(resultado);
      setShowCalculadora(false);
      setTimeout(() => setShowModalInversionista(true), 300);
    } else {
      setShowCalculadora(false);
    }
  };

  const handleInversionistaSeleccionado = async (inversionista) => {
    setShowModalInversionista(false);
    
    if (!datosCalculados || !inversionista) {
      mostrarToast('Faltan datos para guardar la inversión', 'error');
      return;
    }

    setGuardando(true);
    try {
      const datosInversion = {
        numero_serie_vehiculo: vehiculo.NumeroSerie,
        inversionista_id: inversionista.id,
        modelo_negocio: datosCalculados.modelo || 'AUTOMANAGER',
        valor_factura: datosCalculados.datosVehiculo?.valor_factura,
        polizas: datosCalculados.datosVehiculo?.polizas,
        placas: datosCalculados.datosVehiculo?.placas,
        gps: datosCalculados.datosVehiculo?.gps,
        otros_gastos: datosCalculados.datosVehiculo?.otros_gastos,
        renta_diaria: datosCalculados.datosVehiculo?.renta_diaria,
        plazo_meses: datosCalculados.datosVehiculo?.plazo_meses,
        tasa_rendimiento: datosCalculados.datosVehiculo?.tasa_rendimiento,
        inversion_total: datosCalculados.datosVehiculo?.inversion_total,
        corrida_total: datosCalculados.datosVehiculo?.corrida_total,
        utilidad_total: datosCalculados.datosVehiculo?.utilidad_total,
        calculos: datosCalculados.calculos
      };

      const response = await adminService.crearInversionVehiculo(datosInversion);
      
      if (response.success) {
        mostrarToast('✅ Inversión creada y asignada exitosamente', 'success');
        await cargarInversion();
        setDatosCalculados(null);
      } else {
        throw new Error(response.message || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error guardando inversión:', error);
      mostrarToast('Error al guardar la inversión: ' + error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const calcularProximoPago = () => {
    if (!inversion?.fecha_inicio_inversion) return null;
    
    const fechaInicio = new Date(inversion.fecha_inicio_inversion);
    const hoy = new Date();
    
    const mesesTranscurridos = Math.floor(
      (hoy.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    
    const proximoPago = new Date(fechaInicio);
    proximoPago.setMonth(proximoPago.getMonth() + mesesTranscurridos + 1);
    
    const diasHasta = Math.ceil((proximoPago - hoy) / (1000 * 60 * 60 * 24));
    
    return {
      fecha: proximoPago,
      dias: diasHasta,
      vencido: diasHasta < 0,
      proximo: diasHasta >= 0 && diasHasta <= 7,
      normal: diasHasta > 7
    };
  };

  const mostrarToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const calcularPorcentajeRecuperado = () => {
    if (!inversion) return 0;
    const recuperado = parseFloat(inversion.total_recuperado || 0);
    const total = parseFloat(inversion.total_corrida || inversion.inversion || 0);
    return total > 0 ? (recuperado / total) * 100 : 0;
  };

  // ========== FUNCIÓN PARA NAVEGAR A LA PÁGINA ==========
  const handleVerHistorial = () => {
    navigate(`/rentabilidad-vehiculo/${vehiculo?.NumeroSerie}`);
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 border border-primary/20">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // ========== ESTADO 0: INVERSIÓN SIN INVERSIONISTA - EXPANDIDO ==========
  if (inversion && !inversion.inversionista_id && !guardando) {
    const modeloNegocio = inversion.modelo_negocio || 'SI_LEGADO';
    const porcentajeRecuperado = calcularPorcentajeRecuperado();

    return (
      <div className="glass rounded-2xl border border-yellow-500/30 overflow-hidden">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white animate-slide-in ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              <div>
                <h2 className="text-xl font-bold text-white">Inversión sin Inversionista</h2>
                <p className="text-yellow-400 text-sm mt-1">
                  Este vehículo tiene datos de inversión pero no está vinculado a ningún inversionista
                </p>
              </div>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${
              modeloNegocio === 'SI_LEGADO' 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'bg-green-500/20 text-green-400 border border-green-500/30'
            }`}>
              <span className="text-base">{modeloNegocio === 'SI_LEGADO' ? '🏛️' : '🚀'}</span>
              {modeloNegocio === 'SI_LEGADO' ? 'SI Legado' : 'AutoManager'}
            </span>
          </div>
        </div>

        {/* Contenido - EXPANDIDO con toda la información */}
        <div className="p-6 space-y-6">
          
          {/* 1. EL HÉROE - Dato Principal */}
          {modeloNegocio === 'AUTOMANAGER' || modeloNegocio === 'PLUS_60' || modeloNegocio === 'SMART_40' ? (
            // AutoManager: Barra de Progreso
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-7xl font-bold text-primary mb-2">
                  {porcentajeRecuperado.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-400 uppercase tracking-wide font-medium">
                  Progreso de Recuperación
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="w-full bg-gray-800 rounded-full h-5 overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-primary via-green-400 to-green-500 rounded-full transition-all duration-700 ease-out shadow-lg"
                    style={{ width: `${Math.min(porcentajeRecuperado, 100)}%` }}
                  />
                </div>
                
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Recuperado</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(inversion.total_recuperado || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase">Objetivo</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(inversion.total_corrida)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // SI Legado: Pago Fijo
            <div className="text-center space-y-3 py-4">
              <p className="text-6xl font-bold text-white">
                {formatCurrency(inversion.pago_mensual_inversionista || 8000)}
              </p>
              <p className="text-sm text-gray-400 uppercase tracking-wide font-medium">
                Pago Fijo al Inversionista / mes
              </p>
              <p className="text-base text-gray-500">
                Utilidad Mensual: <span className="text-primary font-bold">{formatCurrency(2400)}</span>
              </p>
            </div>
          )}

          {/* 2. DETALLES - Columnas de información */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">

            {/* Columna Izquierda - Logística */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-700 pb-2">
                Información Logística
              </h3>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-yellow-400" />
                  <p className="text-xs text-yellow-400 uppercase font-bold">Inversionista</p>
                </div>
                <p className="text-base font-bold text-white">Sin asignar</p>
                <p className="text-sm text-gray-500">Requiere vinculación</p>
              </div>
              
              {inversion.fecha_inicio_inversion && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-primary" />
                    <p className="text-xs text-gray-500 uppercase">Fecha Inicio</p>
                  </div>
                  <p className="text-base font-bold text-white">
                    {new Date(inversion.fecha_inicio_inversion).toLocaleDateString('es-MX', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
              )}
              
              {inversion.plazo_para_inversionistas && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-primary" />
                    <p className="text-xs text-gray-500 uppercase">Plazo</p>
                  </div>
                  <p className="text-base font-bold text-white">{inversion.plazo_para_inversionistas} meses</p>
                </div>
              )}
            </div>

            {/* Columna Derecha - Finanzas */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-700 pb-2">
                Información Financiera
              </h3>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-gray-500 uppercase">Inversión Inicial</p>
                </div>
                <p className="text-base font-bold text-white">{formatCurrency(inversion.inversion)}</p>
              </div>
              
              {inversion.pago_mensual_inversionista && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <p className="text-xs text-gray-500 uppercase">Pago Mensual</p>
                  </div>
                  <p className="text-base font-bold text-white">{formatCurrency(inversion.pago_mensual_inversionista)}</p>
                </div>
              )}
              
              {inversion.total_corrida && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-blue-400" />
                    <p className="text-xs text-gray-500 uppercase">
                      {modeloNegocio === 'SI_LEGADO' ? 'Total a Pagar' : 'Utilidad Proyectada'}
                    </p>
                  </div>
                  <p className="text-base font-bold text-white">
                    {formatCurrency(inversion.total_corrida || inversion.utilidad_empresa || 0)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. BOTONES DE ACCIÓN - DOS BOTONES */}
          <div className="space-y-3 pt-4 border-t border-gray-700">
            
            {/* Botón Principal: Vincular */}
            <button
              onClick={() => setShowVincularModal(true)}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl px-8 py-4 font-bold text-lg hover:shadow-lg hover:shadow-yellow-500/30 transition-all transform hover:scale-105 flex items-center justify-center gap-3"
            >
              <User className="w-6 h-6" />
              Vincular a Inversionista
            </button>

            {/* Botón Secundario: Ver Historial */}
            <button 
              onClick={handleVerHistorial}
              className="w-full bg-transparent border-2 border-gray-700 hover:border-primary text-gray-300 hover:text-white font-medium rounded-xl px-5 py-3 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Ver Historial de Pagos
            </button>
          </div>

        </div>

        {/* Modal Vincular - Versión SIMPLE */}
        {showVincularModal && (
          <VincularInversionistaModal
            inversion={inversion}
            onClose={() => setShowVincularModal(false)}
            onSuccess={() => {
              cargarInversion();
              setShowVincularModal(false);
            }}
          />
        )}
      </div>
    );
  }

  // ========== NUEVO: ESTADO ESPECIAL PARA SOCIO DUEÑO (SD) ==========
if (!inversion && vehiculo?.TipoSocio === 'SD' && vehiculo?.total_corrida && !guardando) {
  return (
    <div className="glass rounded-2xl border border-green-500/30 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white animate-slide-in ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="p-6 border-b border-green-500/30 bg-green-500/5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Información de Corrida - Socio Dueño (SD)</h2>
          <span className="px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 bg-green-500/20 text-green-400 border border-green-500/30">
            <span className="text-base">🚗</span>
            Socio Dueño
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6 space-y-6">
        
        {/* 1. BARRA DE PROGRESO PRINCIPAL */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm font-medium">Progreso de Pago</span>
            <span className="text-primary font-bold text-2xl">
              {vehiculo.porcentaje_pagado?.toFixed(1) || 0}%
            </span>
          </div>
          
          {/* Barra de progreso animada */}
          <div className="w-full bg-gray-800 rounded-full h-6 overflow-hidden shadow-inner border border-gray-700">
            <div 
              className="h-full bg-gradient-to-r from-green-500 via-green-400 to-green-300 rounded-full transition-all duration-700 shadow-lg flex items-center justify-end pr-2"
              style={{ width: `${Math.min(vehiculo.porcentaje_pagado || 0, 100)}%` }}
            >
              {vehiculo.porcentaje_pagado > 10 && (
                <span className="text-white text-xs font-bold">
                  {vehiculo.porcentaje_pagado?.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          
          {/* Montos pagado vs pendiente */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Ya Pagado</p>
              <p className="text-white font-bold text-lg">
                {formatCurrency(vehiculo.total_pagado_corrida || 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Saldo Pendiente</p>
              <p className="text-white font-bold text-lg">
                {formatCurrency(vehiculo.saldo_pendiente_corrida || 0)}
              </p>
            </div>
          </div>

          {/* Fecha de inicio (si existe) */}
          {vehiculo.fecha_inicio_corrida && (
            <div className="text-center pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-500">
                Inicio del plan: {new Date(vehiculo.fecha_inicio_corrida).toLocaleDateString('es-MX', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          )}
        </div>

        {/* 2. DATOS DEL CONTRATO EN GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <p className="text-xs text-gray-400 uppercase">Corrida Total (Deuda)</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(vehiculo.total_corrida)}</p>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-xs text-gray-400 uppercase">Multiplicador</p>
            </div>
            <p className="text-2xl font-bold text-green-400">{vehiculo.multiplicador_corrida}x</p>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-gray-400 uppercase">Plazo</p>
            </div>
            <p className="text-2xl font-bold text-primary">{vehiculo.plazo_corrida} meses</p>
          </div>
        </div>

        {/* 3. MENSAJE EXPLICATIVO */}
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-green-300 text-sm leading-relaxed">
                Este vehículo tiene un plan de <strong>Socio Dueño (SD)</strong>. El conductor está pagando una corrida de{' '}
                <strong className="text-white">{formatCurrency(vehiculo.total_corrida)}</strong> en{' '}
                <strong className="text-white">{vehiculo.plazo_corrida} meses</strong> para quedarse con el vehículo.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Lleva pagado el <strong>{vehiculo.porcentaje_pagado?.toFixed(1)}%</strong> del total.
              </p>
            </div>
          </div>
        </div>

        {/* 4. BOTÓN DE ACCIÓN */}
        <button 
          onClick={handleVerHistorial}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl px-5 py-4 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-green-500/30 transform hover:scale-105"
        >
          <CheckCircle className="w-5 h-5" />
          Ver Historial de Pagos
        </button>
      </div>
    </div>
  );
}

  // ========== ESTADO 1: SIN INVERSIÓN - Empty State Limpio ==========
  if (!inversion && !guardando) {
    // Si es SD pero no tiene datos de corrida
    if (vehiculo?.TipoSocio === 'SD') {
      return (
        <div className="glass rounded-2xl border border-yellow-500/30 overflow-hidden">
          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white animate-slide-in ${
              toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {toast.message}
            </div>
          )}

          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">Información de Inversión</h2>
          </div>

          {/* Centro - Empty State SD sin datos */}
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-12 h-12 text-yellow-400" />
            </div>
            <p className="text-yellow-300 text-lg mb-4 font-semibold">
              Vehículo Socio Dueño (SD)
            </p>
            <p className="text-gray-400 text-sm mb-8">
              Este vehículo SD fue creado antes de la implementación del sistema de corridas.
              Los datos de inversión no están disponibles.
            </p>
          </div>
        </div>
      );
    }

    // SI/SA sin inversión
    return (
      <div className="glass rounded-2xl border border-primary/20 overflow-hidden">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white animate-slide-in ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Información de Inversión</h2>
        </div>

        {/* Centro - Empty State */}
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <TrendingUp className="w-12 h-12 text-primary/40" />
          </div>
          <p className="text-gray-400 text-lg mb-8">
            Este vehículo no tiene un plan de inversión.
          </p>
          
          {/* CTA Único */}
          <button
            onClick={onAsignarInversionClick}
            className="w-full max-w-md bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl px-8 py-4 font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all transform hover:scale-105 flex items-center justify-center gap-3 shadow-xl"
          >
            <Calculator className="w-6 h-6" />
            Asignar Inversión Manualmente
          </button>
        </div>

        {/* Modales */}
        <CalculadoraInversion 
          isOpen={showCalculadora}
          onClose={handleCalculosCompletados}
          datosIniciales={{}}
        />
        
        <ModalInversionistas
          isOpen={showModalInversionista}
          onClose={() => setShowModalInversionista(false)}
          onSelect={handleInversionistaSeleccionado}
        />
      </div>
    );
  }

  if (guardando) {
    return (
      <div className="glass rounded-2xl p-8 border border-primary/20">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-white font-medium">Guardando inversión...</p>
        </div>
      </div>
    );
  }

  // ========== ESTADOS 2 y 3: CON INVERSIÓN - Layout con MEJORAS APLICADAS ==========
  const porcentajeRecuperado = calcularPorcentajeRecuperado();
  const modeloNegocio = inversion.modelo_negocio || 'SI_LEGADO';
  const proximoPago = calcularProximoPago();
  
  return (
    <div className="glass rounded-2xl border border-primary/20 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white animate-slide-in ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 1. HEADER */}
      <div className="p-6 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Información de Inversión</h2>
        <span className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${
          modeloNegocio === 'SI_LEGADO' 
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
            : 'bg-green-500/20 text-green-400 border border-green-500/30'
        }`}>
          <span className="text-base">{modeloNegocio === 'SI_LEGADO' ? '🏛️' : '🚀'}</span>
          {modeloNegocio === 'SI_LEGADO' ? 'SI Legado' : 'AutoManager'}
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* 2. EL HÉROE */}
        {modeloNegocio === 'AUTOMANAGER' ? (
          // AutoManager: Barra de Progreso
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-7xl font-bold text-primary mb-2">
                {porcentajeRecuperado.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-400 uppercase tracking-wide font-medium">
                Progreso de Recuperación
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="w-full bg-gray-800 rounded-full h-5 overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-primary via-green-400 to-green-500 rounded-full transition-all duration-700 ease-out shadow-lg"
                  style={{ width: `${Math.min(porcentajeRecuperado, 100)}%` }}
                />
              </div>
              
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Recuperado</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(inversion.total_recuperado || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Objetivo</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(inversion.total_corrida)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // SI Legado: Pago Fijo
          <div className="text-center space-y-3 py-4">
            <p className="text-6xl font-bold text-white">
              {formatCurrency(8000)}
            </p>
            <p className="text-sm text-gray-400 uppercase tracking-wide font-medium">
              Pago Fijo al Inversionista / mes
            </p>
            <p className="text-base text-gray-500">
              Utilidad Mensual: <span className="text-primary font-bold">{formatCurrency(2400)}</span>
            </p>
          </div>
        )}

        {/* 3. ACCIÓN PRINCIPAL */}
        {proximoPago && (
          <div className={`rounded-xl p-5 ${
            proximoPago.vencido 
              ? 'bg-red-500/10 border-2 border-red-500/40'
              : proximoPago.proximo
              ? 'bg-yellow-500/10 border-2 border-yellow-500/40'
              : 'bg-blue-500/10 border-2 border-blue-500/30'
          }`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3 flex-1">
                {proximoPago.vencido ? (
                  <AlertTriangle className="w-6 h-6 text-red-400 mt-1 flex-shrink-0" />
                ) : proximoPago.proximo ? (
                  <Clock className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
                ) : (
                  <Calendar className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-bold text-lg ${
                    proximoPago.vencido ? 'text-red-400' : proximoPago.proximo ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {proximoPago.vencido 
                      ? `Pago VENCIDO`
                      : proximoPago.proximo
                      ? `Próximo pago vence pronto`
                      : `Próximo pago programado`
                    }
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {proximoPago.vencido 
                      ? `Hace ${Math.abs(proximoPago.dias)} día${Math.abs(proximoPago.dias) !== 1 ? 's' : ''}`
                      : proximoPago.proximo
                      ? `En ${proximoPago.dias} día${proximoPago.dias !== 1 ? 's' : ''} (${proximoPago.fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})`
                      : proximoPago.fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Monto: <span className="font-bold text-white">
                      {modeloNegocio === 'SI_LEGADO' 
                        ? formatCurrency(8000)
                        : formatCurrency((inversion.renta || 400) * 26)
                      }
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            <button className={`w-full font-bold rounded-lg px-5 py-3 transition-all flex items-center justify-center gap-2 shadow-lg ${
              proximoPago.vencido
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : proximoPago.proximo
                ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
                : 'bg-primary hover:bg-primary-light text-dark'
            }`}>
              <DollarSign className="w-5 h-5" />
              Registrar Pago Ahora
            </button>
          </div>
        )}

        {/* 4. DETALLES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">

          {/* Columna Izquierda - Logística */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-700 pb-2">
              Información Logística
            </h3>
            
            {inversion.inversionista_nombre && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-primary" />
                  <p className="text-xs text-gray-500 uppercase">Inversionista</p>
                </div>
                <p className="text-base font-bold text-white truncate">{inversion.inversionista_nombre}</p>

                {inversion.inversionista_email && (
                  <p className="text-sm text-gray-500 truncate">{inversion.inversionista_email}</p>
                )}
              </div>
            )}
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary" />
                <p className="text-xs text-gray-500 uppercase">Fecha Inicio</p>
              </div>
              <p className="text-base font-bold text-white">
                {inversion.fecha_inicio_inversion 
                  ? new Date(inversion.fecha_inicio_inversion).toLocaleDateString('es-MX', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })
                  : 'No definida'}
              </p>
            </div>
            
            {inversion.plazo_en_meses && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-primary" />
                  <p className="text-xs text-gray-500 uppercase">Plazo</p>
                </div>
                <p className="text-base font-bold text-white">{inversion.plazo_en_meses} meses</p>
              </div>
            )}
          </div>

          {/* Columna Derecha - Finanzas */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-700 pb-2">
              Información Financiera
            </h3>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-400" />
                <p className="text-xs text-gray-500 uppercase">Inversión Inicial</p>
              </div>
              <p className="text-base font-bold text-white">{formatCurrency(inversion.inversion)}</p>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-gray-500 uppercase">
                  {modeloNegocio === 'SI_LEGADO' ? 'Ingreso Conductor' : 'Utilidad Proyectada'}
                </p>
              </div>
              <p className="text-base font-bold text-white">
                {modeloNegocio === 'SI_LEGADO' 
                  ? formatCurrency(10400)
                  : formatCurrency(inversion.utilidad_empresa || 0)
                }
              </p>
            </div>
            
            {inversion.renta && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <p className="text-xs text-gray-500 uppercase">Renta Diaria</p>
                </div>
                <p className="text-base font-bold text-white">{formatCurrency(inversion.renta)}</p>
              </div>
            )}
          </div>
        </div>

        {/* 5. ACCIÓN SECUNDARIA */}
        <button 
          onClick={handleVerHistorial}
          className="w-full bg-transparent border-2 border-gray-700 hover:border-primary text-gray-300 hover:text-white font-medium rounded-xl px-5 py-3 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          Ver Historial de Pagos
        </button>
      </div>
    </div>
  );
};

export default VehicleInvestmentPanel;