import React from 'react';
import { DollarSign, TrendingUp, Calendar, CheckCircle } from 'lucide-react';

const VehiculoCorridaPanel = ({ vehiculo }) => {
  if (!vehiculo) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // 🚀 DATOS DEL VEHÍCULO Y CÁLCULOS
  const totalCorrida = parseFloat(vehiculo.total_corrida || 0);
  const multiplicador = vehiculo.multiplicador_corrida || 0;
  const plazo = vehiculo.plazo_corrida || 0;
  const pagado = parseFloat(vehiculo.total_pagado_corrida || vehiculo.TotalPagadoCorrida || vehiculo.pagado || 0);
  
  const pendiente = vehiculo.saldo_pendiente_corrida !== undefined 
    ? parseFloat(vehiculo.saldo_pendiente_corrida) 
    : Math.max(0, totalCorrida - pagado);

  const porcentaje = vehiculo.porcentaje_pagado !== undefined 
    ? parseFloat(vehiculo.porcentaje_pagado) 
    : (totalCorrida > 0 ? (pagado / totalCorrida) * 100 : 0);

  // 🚀 LÓGICA DINÁMICA DE TIPO DE SOCIO
  const tipoSocioClave = vehiculo.TipoSocio || 'SD';
  const esSD = tipoSocioClave === 'SD' || tipoSocioClave === 'Socio Dueño';
  const nombreSocio = esSD ? 'Socio Dueño' : 'Socio Inversionista';
  const tituloCompleto = `${nombreSocio} (${tipoSocioClave})`;

  return (
    /* Contenedor Principal (Estilo Premium Dark) */
    <div className="bg-[#121c2d] rounded-2xl border border-emerald-500/20 shadow-2xl overflow-hidden w-full font-sans">
      
      {/* HEADER DINÁMICO */}
      <div className="p-6 border-b border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
        <h2 className="text-xl lg:text-2xl font-bold text-white leading-tight">
          Información de Corrida<br/>
          <span className="text-gray-400 font-normal text-sm lg:text-base">- {tituloCompleto}</span>
        </h2>
        <span className="px-4 py-2 rounded-full text-xs lg:text-sm font-bold flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
          🚗 {nombreSocio}
        </span>
      </div>

      <div className="p-6 lg:p-8 space-y-8">
        
        {/* ========================================== */}
        {/* 1. SECCIÓN DE PROGRESO */}
        {/* ========================================== */}
        <div className="space-y-3">
          <div className="flex justify-between items-end mb-2">
            <span className="text-gray-400 text-sm lg:text-base font-medium">Progreso de Pago</span>
            {/* 🚀 EL FIX ESTÁ AQUÍ: Reducimos ligeramente el tamaño de fuente en pantallas pequeñas */}
            <span className="text-emerald-400 font-bold text-3xl lg:text-4xl tracking-tight">
              {Number(porcentaje).toFixed(1)}%
            </span>
          </div>
          
          {/* Barra de progreso visual - MÁS GRUESA */}
          <div className="w-full bg-black/40 rounded-full h-5 lg:h-6 overflow-hidden shadow-inner border border-white/5 relative">
            <div 
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
              style={{ width: `${Math.min(porcentaje, 100)}%` }}
            />
          </div>
          
          {/* Subtítulos de Ya Pagado / Saldo Pendiente - TEXTO AJUSTADO */}
          <div className="flex justify-between text-sm lg:text-base pt-2">
            <div>
              <p className="text-gray-500 uppercase tracking-wider font-bold mb-1">Ya Pagado</p>
              {/* 🚀 EL FIX ESTÁ AQUÍ: Tamaño de fuente adaptable y tracking-tight */}
              <p className="text-white font-extrabold text-lg lg:text-2xl tracking-tight break-all">{formatCurrency(pagado)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 uppercase tracking-wider font-bold mb-1">Saldo Pendiente</p>
              {/* 🚀 EL FIX ESTÁ AQUÍ: Tamaño de fuente adaptable y tracking-tight */}
              <p className="text-white font-extrabold text-lg lg:text-2xl tracking-tight break-all">{formatCurrency(pendiente)}</p>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. TARJETAS DE DATOS (TAMAÑOS CORREGIDOS) */}
        {/* ========================================== */}
        <div className="flex flex-col gap-4 lg:gap-5">
          
          {/* Tarjeta 1: Corrida Total */}
          <div className="bg-[#1a2639] rounded-2xl p-5 lg:p-6 border border-white/5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-emerald-500/10 rounded-xl flex-shrink-0">
                <DollarSign className="w-6 h-6 lg:w-7 lg:h-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm lg:text-base text-gray-400 uppercase font-bold tracking-wide mb-0.5">
                  Corrida Total
                </p>
                <p className="text-gray-500 text-[10px] lg:text-xs leading-tight hidden sm:block">
                  Monto total adeudado a recibir
                </p>
              </div>
            </div>
            {/* 🚀 FIX: shrink-0 evita que el número se parta, y bajamos el tamaño a algo más elegante */}
            <p className="text-xl lg:text-2xl font-extrabold text-white text-right shrink-0">
              {formatCurrency(totalCorrida)}
            </p>
          </div>
          
          {/* Tarjeta 2: Multiplicador */}
          <div className="bg-[#1a2639] rounded-2xl p-5 lg:p-6 border border-white/5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-cyan-500/10 rounded-xl flex-shrink-0">
                <TrendingUp className="w-6 h-6 lg:w-7 lg:h-7 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm lg:text-base text-gray-400 uppercase font-bold tracking-wide mb-0.5">
                  Multiplicador
                </p>
                <p className="text-gray-500 text-[10px] lg:text-xs leading-tight hidden sm:block">
                  Factor de rendimiento
                </p>
              </div>
            </div>
            {/* 🚀 FIX: shrink-0 y tamaño proporcionado */}
            <p className="text-xl lg:text-2xl font-extrabold text-cyan-400 text-right shrink-0">
              {multiplicador}x
            </p>
          </div>
          
          {/* Tarjeta 3: Plazo */}
          <div className="bg-[#1a2639] rounded-2xl p-5 lg:p-6 border border-white/5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-blue-500/10 rounded-xl flex-shrink-0">
                <Calendar className="w-6 h-6 lg:w-7 lg:h-7 text-blue-400" />
              </div>
              <div>
                <p className="text-sm lg:text-base text-gray-400 uppercase font-bold tracking-wide mb-0.5">
                  Plazo
                </p>
                <p className="text-gray-500 text-[10px] lg:text-xs leading-tight hidden sm:block">
                  Duración del contrato
                </p>
              </div>
            </div>
            {/* 🚀 FIX: shrink-0 y tamaño proporcionado */}
            <div className="text-right shrink-0">
              <p className="text-xl lg:text-2xl font-extrabold text-blue-400">
                {plazo}
              </p>
              <p className="text-blue-400/60 text-[10px] lg:text-xs font-bold uppercase tracking-widest mt-0.5">meses</p>
            </div>
          </div>
          
        </div>

        {/* ========================================== */}
        {/* 3. MENSAJE EXPLICATIVO INFERIOR (DINÁMICO) */}
        {/* ========================================== */}
        <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-emerald-400 mt-1 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-gray-300 text-sm lg:text-base leading-relaxed break-all">
                Este vehículo tiene un plan de <strong className="text-emerald-400 break-all">{tituloCompleto}</strong>. El conductor está pagando una corrida de{' '}
                <strong className="text-white break-all">{formatCurrency(totalCorrida)}</strong> en{' '}
                <strong className="text-white break-all">{plazo} meses</strong> para quedarse con el vehículo.
              </p>
              <p className="text-sm lg:text-base text-gray-400 font-medium">
                Lleva pagado el <span className="text-white font-bold">{Number(porcentaje).toFixed(1)}%</span> del total.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VehiculoCorridaPanel;