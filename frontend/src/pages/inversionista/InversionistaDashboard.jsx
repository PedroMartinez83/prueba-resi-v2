import React, { useState, useEffect, useMemo } from 'react';
import { Briefcase, TrendingUp, DollarSign, Clock, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import inversionistaService from '../../services/inversionistaService'; // El que creamos antes
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Line, 
  ComposedChart, 
  Bar, 
  Cell,
  LabelList
} from 'recharts';

const InversionistaDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        if (user?.inversionistaId) {
          // Usamos el service para traer los datos del endpoint getInversionistaById
          const response = await inversionistaService.fetchWithAuth(`/admin/inversionistas/${user.inversionistaId}`);
          if (response.success) {
            setData(response);
          }
        }
      } catch (error) {
        console.error("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  // 📊 Cálculos automáticos basados en la data del endpoint
  const stats = useMemo(() => {
    if (!data || !data.inversiones) return { activos: 0, capital: 0, ganancias: 0, gananciasRestantes: 0, proximoPago: 'N/A' }; // Valor por defecto mientras carga o si no hay datos

    const contratosValidos = data.inversiones.filter(inv => inv.status !== 'Eliminado');
    
    // 1. Capital Total Histórico
    const capital = contratosValidos.reduce((acc, inv) => acc + parseFloat(inv.monto_invertido || 0), 0);

    // ========================================================
    // 1. CÁLCULO DE GANANCIAS OBTENIDAS (Tu código original)
    // ========================================================
    const ganancias = contratosValidos.reduce((acc, inv) => {
      const inversionInicial = parseFloat(inv.monto_invertido || 0);
      const plazoMeses = parseInt(inv.plazo_meses || 1, 10);
      const totalPagado = parseFloat(inv.total_pagado || 0);
      const totalContrato = parseFloat(inv.monto_total_contrato || 0);
      
      let pagosRealizados = parseInt(inv.pagos_realizados || 0, 10);
      const cuotaMensualEsperada = plazoMeses > 0 ? (totalContrato / plazoMeses) : 0;

      // 🛡️ Blindaje anti-datos faltantes
      if (pagosRealizados === 0 && cuotaMensualEsperada > 0 && totalPagado > 0) {
        pagosRealizados = Math.floor(totalPagado / cuotaMensualEsperada);
      }

      // 🧠 Magia Contable: Desmenuzamos el capital devuelto
      const porcionCapitalMensual = plazoMeses > 0 ? (inversionInicial / plazoMeses) : 0;
      const capitalYaAmortizado = porcionCapitalMensual * pagosRealizados;

      const gananciaNeta = Math.max(0, totalPagado - capitalYaAmortizado);

      return acc + gananciaNeta;
    }, 0);


    // ========================================================
    // 2. CÁLCULO DE GANANCIAS RESTANTES (El nuevo bloque)
    // ========================================================
    const gananciasRestantes = contratosValidos.reduce((acc, inv) => {
      const inversionInicial = parseFloat(inv.monto_invertido || 0);
      const plazoMeses = parseInt(inv.plazo_meses || 1, 10);
      const totalPagado = parseFloat(inv.total_pagado || 0);
      const totalContrato = parseFloat(inv.monto_total_contrato || 0);
      
      let pagosRealizados = parseInt(inv.pagos_realizados || 0, 10);
      const cuotaMensualEsperada = plazoMeses > 0 ? (totalContrato / plazoMeses) : 0;

      if (pagosRealizados === 0 && cuotaMensualEsperada > 0 && totalPagado > 0) {
        pagosRealizados = Math.floor(totalPagado / cuotaMensualEsperada);
      }

      // Paso A: Saber cuánto ya cobró de pura ganancia (repetimos tu fórmula)
      const porcionCapitalMensual = plazoMeses > 0 ? (inversionInicial / plazoMeses) : 0;
      const capitalYaAmortizado = porcionCapitalMensual * pagosRealizados;
      const gananciaYaCobrada = Math.max(0, totalPagado - capitalYaAmortizado);

      // Paso B: Saber cuál era la ganancia total prometida desde el día 1 (Ej. 140k - 100k = 40k)
      const gananciaTotalPrometida = Math.max(0, totalContrato - inversionInicial);

      // Paso C: La ganancia futura es simplemente lo prometido menos lo que ya cobró
      const gananciaPendiente = Math.max(0, gananciaTotalPrometida - gananciaYaCobrada);

      return acc + gananciaPendiente;
    }, 0);

    // 3. Próximo Pago (Solo Activos)
    const contratosEstrictamenteActivos = contratosValidos.filter(inv => inv.status === 'Activa');
    let fechaMasCercana = null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); 

    contratosEstrictamenteActivos.forEach(inv => {
      const siguienteFechaPago = new Date(inv.fecha_inicio);
      const pagosHechos = parseInt(inv.pagos_realizados || 0);
      siguienteFechaPago.setMonth(siguienteFechaPago.getMonth() + pagosHechos + 1);

      if (siguienteFechaPago >= hoy) {
        if (!fechaMasCercana || siguienteFechaPago < fechaMasCercana) {
          fechaMasCercana = new Date(siguienteFechaPago);
        }
      }
    });

    const formatoElegante = fechaMasCercana 
      ? fechaMasCercana.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
      : 'Pendiente';

    const recuperacionTotal = contratosValidos.reduce((acc, inv) => {
    const inversionInicial = parseFloat(inv.monto_invertido || 0);
    const totalPagado = parseFloat(inv.total_pagado || 0);
    
    // Lo que realmente ha vuelto a su bolsillo (incluyendo capital e interés)
    // respecto a su inversión inicial.
    return acc + (totalPagado / inversionInicial);
  }, 0) / (contratosValidos.length || 1);

  const porcentajeRecuperacion = Math.min(100, recuperacionTotal * 100);

    return {
      activos: contratosValidos.length,
      capital: capital,
      ganancias: ganancias, // 👈 Pasamos el nuevo dato al front
      gananciasRestantes: gananciasRestantes, // 👈 Y también el cálculo de lo que falta por ganar
      proximoPago: formatoElegante,
      recuperacion: porcentajeRecuperacion.toFixed(1)
    };
  }, [data]);

  // 📊 Datos para la gráfica de polígono (Contratos vs Pagos Realizados)
  const chartData = useMemo(() => {
    if (!data || !data.inversiones) return [];
    
    return data.inversiones
      // 🚀 GRÁFICA: Todos menos los eliminados
      .filter(inv => inv.status !== 'Eliminado')
      // 🚀 MAGIA: Agregamos el 'index' para numerarlos
      .map((inv, index) => {
        const nombreBase = inv.vehiculo_numero 
          ? `Vehículo ${inv.vehiculo_numero}` 
          : (inv.modelo_negocio || 'Plan General');

        return {
          // El nombre original por si lo ocupas en otro lado
          contrato: nombreBase, 
          
          // 🔒 AQUÍ ESTÁ EL FIX: Le pegamos el número (ej. SMART_40 #1, SMART_40 #2)
          contratoUnico: `${nombreBase} #${index + 1}`,
            
          pagosRealizados: parseInt(inv.pagos_realizados || 0)
        };
      })
      .reverse(); // Para que los contratos más viejos salgan a la izquierda
  }, [data]);

  // 📈 Datos para la SEGUNDA gráfica: Proyección de Recuperación (Payback)
  const paybackChartData = useMemo(() => {
    if (!data || !data.inversiones) return [];
    
    const contratosValidos = data.inversiones.filter(inv => inv.status !== 'Eliminado');
    const contratosActivos = contratosValidos.filter(inv => inv.status === 'Activa');
    
    // Sumas globales
    const capitalTotal = contratosValidos.reduce((acc, inv) => acc + parseFloat(inv.monto_invertido || 0), 0);
    const cobradoActual = contratosValidos.reduce((acc, inv) => acc + parseFloat(inv.total_pagado || 0), 0);

    // ¿Cuánto dinero fijo entra cada mes por los activos?
    const flujoMensual = contratosActivos.reduce((acc, inv) => {
      const plazo = parseInt(inv.plazo_meses || 1, 10);
      const total = parseFloat(inv.monto_total_contrato || 0);
      return acc + (plazo > 0 ? total / plazo : 0);
    }, 0);

    const proyeccion = [];
    let acumulado = cobradoActual;
    let mesesAdelante = 0;

    // Punto 0: Dónde estamos hoy
    proyeccion.push({ 
      mes: 'Actual', 
      recuperado: Math.round(acumulado), 
      inversion: Math.round(capitalTotal) 
    });

    // Si ya recuperó todo o no hay pagos futuros proyectados
    if (acumulado >= capitalTotal || flujoMensual === 0) {
      proyeccion.push({ 
        mes: '+1 Mes', 
        recuperado: Math.round(acumulado + flujoMensual), 
        inversion: Math.round(capitalTotal) 
      });
      return proyeccion;
    }

    // Proyectamos hacia el futuro hasta llegar a la meta (tope de 24 meses)
    while (acumulado < capitalTotal && mesesAdelante < 24) {
      mesesAdelante++;
      acumulado += flujoMensual;
      
      const etiquetaMes = acumulado >= capitalTotal ? `¡Meta!` : `+${mesesAdelante} Mes`;
      proyeccion.push({ 
        mes: etiquetaMes, 
        recuperado: Math.round(acumulado), 
        inversion: Math.round(capitalTotal) 
      });
    }

    return proyeccion;
  }, [data]);


  // ==========================================
  // DATOS PARA LA GRÁFICA 3: COMPARATIVA POR CONTRATO
  // ==========================================
  const contratosBarData = useMemo(() => {
    // 🛡️ Verificación de seguridad: si no hay data, devolvemos un array vacío
    if (!data || !data.inversiones) return [];

    return data.inversiones
      .filter(inv => inv.status !== 'Eliminado') // Filtramos los borrados
      .map((inv, index) => {
        const nombreBase = inv.modelo_negocio 
          ? inv.modelo_negocio.replace('_', ' ') 
          : 'Contrato';
        
        const inversionInicial = parseFloat(inv.monto_invertido || 0);
        const totalContrato = parseFloat(inv.monto_total_contrato || 0);
        const pagoMensual = parseFloat(inv.pago_mensual_inversionista || inv.pago_mensual || 0);
        const pagosRealizados = parseInt(inv.pagos_realizados || 0, 10);
        
        // Usamos el total_pagado del backend o calculamos el acumulado
        const totalPagado = parseFloat(inv.total_pagado || (pagoMensual * pagosRealizados));
        
        return {
          nombre: `${nombreBase} #${index + 1}`,
          inversionInicial,
          totalPagado,
          totalContrato,
          pagosRealizados,
          yaRecupero: totalPagado >= inversionInicial 
        };
      });
  }, [data]); // 🚀 Se recalcula solo cuando 'data' cambia

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN' // Cambia a USD si manejas dólares
    }).format(amount);
  };

  if (loading) return <div className="text-white p-8">Cargando resumen...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Resumen de Inversiones</h1>
        <p className="text-emerald-400 font-medium">Bienvenido, {data?.inversionista?.nombre}</p>
      </div>

      {/* Tarjetas de Resumen Dinámicas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Contratos Activos */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-emerald-400 font-medium">Contratos Activos</h3>
          </div>
          <p className="text-3xl font-bold text-white">{stats.activos}</p>
        </div>

        {/* Capital Invertido */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-emerald-400 font-medium">Capital Invertido</h3>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(stats.capital)}</p>
        </div>

        {/* 🚀 NUEVA TARJETA: Ganancia Neta Realizada */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-emerald-400 font-medium">Rendimiento obtenido hasta hoy</h3>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(stats.ganancias)}</p>
        </div>   

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-emerald-400 font-medium">Rendimiento
            total a obtener</h3>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(stats.gananciasRestantes)}</p>
        </div>  

        {/* 🚀 NUEVA TARJETA: Ganancia Neta Realizada */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-emerald-400 font-medium">Recuperacion total</h3>
          </div>
          <p className="text-3xl font-bold text-white">{(stats.recuperacion)}%</p>
        </div>     

        {/* Próximo Pago Estimado */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-emerald-400 font-medium">Próximo Pago Estimado</h3>
          </div>
          <p className="text-2xl font-bold text-white">{stats.proximoPago}</p>
        </div>
      </div>

      {/* 🚀 ZONA DE GRÁFICAS (Apiladas verticalmente, una debajo de otra) */}
      <div className="flex flex-col gap-8 mt-8">

        {/* GRÁFICA 3: Progreso por Contrato (Barras + Marca Roja) */}
        {/* <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm mt-6">
          
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white leading-tight">Rendimiento por Contrato</h3>
                <p className="text-xs text-gray-400 mt-0.5">Progreso del total pagado vs inversión inicial</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-black/20 px-4 py-3 rounded-xl border border-white/5 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-500 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                <span className="text-xs sm:text-sm font-medium text-gray-300">Total Pagado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 border-t-4 border-red-500"></div>
                <span className="text-xs sm:text-sm font-medium text-gray-300">Meta: Inversión Inicial</span>
              </div>
            </div>
          </div>
          
          {contratosBarData.length > 0 ? (
            
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
              
              <div className="h-80" style={{ minWidth: `${Math.max(100, contratosBarData.length * 20)}%` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={contratosBarData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    
                    <XAxis 
                      dataKey="nombre" 
                      stroke="#9ca3af" 
                      tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10} 
                    />
                    
                    <YAxis 
                      stroke="#9ca3af" 
                      tick={{ fill: '#9ca3af', fontSize: 11 }} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `$${(val/1000)}k`} 
                      width={50} // 👈 Le damos un ancho fijo al eje Y para que no brinque
                    />
                    
                    
                    <Tooltip 
                      cursor={{ fill: '#ffffff05' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const gananciaPura = Math.max(0, data.totalPagado - data.inversionInicial);
                          const faltaRecuperar = Math.max(0, data.inversionInicial - data.totalPagado);

                          return (
                            <div className="bg-[#0f172a] border border-cyan-500/30 p-3 sm:p-4 rounded-xl shadow-2xl min-w-[220px] max-w-[280px]">
                              <h4 className="text-white font-bold text-base sm:text-lg mb-3 border-b border-white/10 pb-2 truncate">{label}</h4>
                              
                              <div className="space-y-2 text-xs sm:text-sm mb-4">
                                <div className="flex justify-between gap-2">
                                  <span className="text-gray-400">Cuotas pagadas:</span>
                                  <span className="text-white font-medium whitespace-nowrap">{data.pagosRealizados}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-gray-400">Total del contrato:</span>
                                  <span className="text-white font-medium whitespace-nowrap">{formatCurrency(data.totalContrato)}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-red-400">Inversión Inicial:</span>
                                  <span className="text-red-400 font-bold whitespace-nowrap">{formatCurrency(data.inversionInicial)}</span>
                                </div>
                                <div className="flex justify-between bg-white/5 p-1.5 rounded gap-2">
                                  <span className="text-cyan-400 font-medium">Pagado hasta hoy:</span>
                                  <span className="text-cyan-400 font-bold whitespace-nowrap">{formatCurrency(data.totalPagado)}</span>
                                </div>
                              </div>
                              
                              
                              <div className={`p-2 rounded-lg text-[10px] sm:text-xs font-bold text-center border tracking-wide leading-tight ${
                                data.yaRecupero 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                  : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                              }`}>
                                {data.yaRecupero 
                                  ? `¡RECUPERADO! Rendimiento: ${formatCurrency(gananciaPura)}` 
                                  : `Falta ${formatCurrency(faltaRecuperar)} para recuperar`}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    
                   
                    <Bar 
                      dataKey="totalPagado" 
                      fill="#06b6d4" 
                      radius={[6, 6, 0, 0]} 
                      barSize={40} // 👈 Hacemos la barra un poco más delgada para móviles
                      animationDuration={1500}
                    >
                      {contratosBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.yaRecupero ? '#10b981' : '#06b6d4'} />
                      ))}
                    </Bar>
                    
                    
                    <Line 
                      type="monotone" 
                      dataKey="inversionInicial" 
                      stroke="none" 
                      activeDot={false}
                      dot={(props) => {
                        const { cx, cy, key } = props;
                        // 🚀 Ajustamos el ancho de la línea basándonos en cx, en lugar de un número fijo grande
                        // Si la barra mide 40px de ancho, la línea roja debería medir unos 50px (25 a cada lado)
                        return (
                          <line 
                            key={key}
                            x1={cx - 25} 
                            y1={cy} 
                            x2={cx + 25} 
                            y2={cy} 
                            stroke="#ef4444" 
                            strokeWidth={3} 
                            strokeLinecap="round"
                            className="drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                          />
                        );
                      }} 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500 bg-black/20 rounded-xl border border-white/5">
              No hay contratos registrados para analizar
            </div>
          )}
        </div>  */} 

        {/* 🚀 CABECERA Y SIMBOLOGÍA RESPONSIVA */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white leading-tight">Rendimientos por planes de inversión</h3>
                <p className="text-xs text-gray-400 mt-0.5">Progreso de pagos hacia la meta del contrato</p>
              </div>
            </div>

            {/* 🏷️ SIMBOLOGÍA EXACTA */}
            <div className="flex flex-wrap items-center gap-4 bg-black/20 px-4 py-3 rounded-xl border border-white/5 w-full md:w-auto">
              {/* Leyenda 1: Área Gris */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white/5 border border-white/10 rounded-sm"></div>
                <span className="text-xs sm:text-sm font-medium text-gray-400">Contrato Total</span>
              </div>
              
              {/* Leyenda 2: Barra Cyan */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-cyan-500 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                <span className="text-xs sm:text-sm font-medium text-gray-300">Total Pagado</span>
              </div>
              
              {/* Leyenda 3: Línea Roja */}
              <div className="flex items-center gap-2">
                <div className="w-0.5 h-4 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                <span className="text-xs sm:text-sm font-bold text-red-400">Retorno de inversión</span>
              </div>
            </div>
          </div>

        {contratosBarData.length > 0 ? (
            /* 🚀 CONTENEDOR CON SCROLL HORIZONTAL */
            /* En móvil, esto permitirá deslizar hacia la derecha sin que la gráfica se apachurre */
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
              
              {/* 🚀 AUMENTAMOS EL MIN-WIDTH a 800px para garantizar que el texto tenga espacio de sobra */}
              <div style={{ minWidth: '800px', height: `${Math.max(350, contratosBarData.length * 100)}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart layout="vertical" data={contratosBarData} margin={{ top: 30, right: 50, left: 10, bottom: 0 }} barGap={-48}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={true} vertical={false} />
                    
                    {/* Ejes */}
                    <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val)} />
                    <YAxis dataKey="nombre" type="category" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }} tickLine={false} axisLine={false} width={100} />
                    
                    {/* Tooltip (Se queda igual de detallado) */}
                    <Tooltip 
                      cursor={{ fill: '#ffffff05' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const gananciaPura = Math.max(0, data.totalPagado - data.inversionInicial);

                          return (
                            <div className="bg-[#0f172a] border border-emerald-500/30 p-4 rounded-xl shadow-2xl min-w-[260px]">
                              <h4 className="text-white font-bold text-lg mb-3 border-b border-white/10 pb-2 truncate">{label}</h4>
                              <div className="space-y-2 text-sm mb-4">
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-400">Total del Contrato:</span>
                                  <span className="text-white font-medium">{formatCurrency(data.totalContrato)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-400">Inversión (Capital):</span>
                                  <span className="text-red-400 font-medium">{formatCurrency(data.inversionInicial)}</span>
                                </div>
                                <div className="flex justify-between bg-white/5 p-1.5 rounded gap-4 mt-2">
                                  <span className="text-cyan-400 font-medium">Total Pagado:</span>
                                  <span className="text-cyan-400 font-bold">{formatCurrency(data.totalPagado)}</span>
                                </div>
                              </div>
                              <div className={`p-2.5 rounded-lg text-xs font-bold text-center border tracking-wide ${
                                data.yaRecupero ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'
                              }`}>
                                {data.yaRecupero ? `🔥 RENDIMIENTO PURO: ${formatCurrency(gananciaPura)}` : `En fase de recuperación`}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    
                    {/* 🚀 BARRA DE FONDO (LA META) */}
                    <Bar dataKey="totalContrato" fill="#ffffff08" stroke="#ffffff10" radius={[0, 8, 8, 0]} barSize={48} animationDuration={1000}>
                      <LabelList
                        dataKey="totalContrato"
                        position="right"
                        /* 🚀 CAMBIO AQUÍ */
                        formatter={(val) => formatCurrency(val)}
                        fill="#9ca3af"
                        fontSize={13}
                        fontWeight={600}
                        offset={10}
                      />
                    </Bar>
                    
                    {/* 🚀 BARRA DE PROGRESO (LO PAGADO) - TODAS EN CYAN */}
                    <Bar dataKey="totalPagado" fill="#06b6d4" radius={[0, 8, 8, 0]} barSize={48} animationDuration={1500}>
                      <LabelList
                        dataKey="totalPagado"
                        position="insideLeft"
                        /* 🚀 CAMBIO AQUÍ */
                        formatter={(val) => formatCurrency(val)}
                        fill="#ffffff"
                        fontSize={11}
                        fontWeight="bold"
                        offset={15}
                      />
                    </Bar>
                    
                    {/* 🚀 LA MARCA ROJA (EL CAPITAL INICIAL) */}
                    <Line 
                      type="monotone" 
                      dataKey="inversionInicial" 
                      stroke="none" 
                      activeDot={false}
                      dot={(props) => {
                        const { cx, cy, key, payload } = props;
                        return (
                          <g key={key} className="drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]">
                            <line x1={cx} y1={cy - 28} x2={cx} y2={cy + 28} stroke="#ef4444" strokeWidth={3} strokeDasharray="4 4" strokeLinecap="round" />
                            
                            {/* Texto corto para el inicial flotando */}
                            <text x={cx} y={cy - 34} fill="#ef4444" fontSize={12} fontWeight="bold" textAnchor="middle">
                              {formatCurrency(payload.inversionInicial)}
                            </text>
                            
                            <polygon points={`${cx-6},${cy-28} ${cx+6},${cy-28} ${cx},${cy-20}`} fill="#ef4444" />
                          </g>
                        );
                      }} 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500 bg-black/20 rounded-xl border border-white/5">
              No hay contratos registrados para analizar
            </div>
          )}
        
        {/* GRÁFICA 1: La tuya original (Frecuencia de Pagos) */}
        {/* <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Frecuencia de pagos por contrato</h3>
          </div>
          
          {chartData.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: -10, right: 30, left: -20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorPagos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="contratoUnico" 
                    stroke="#9ca3af" 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} // 👈 Letra un poquito más pequeña para móviles
                    tickLine={false} 
                    axisLine={false} 
                    dy={5}
                    dx={22}
                    angle={-38} // 👈 Más inclinado para que quepan uno al lado del otro
                    textAnchor="end" 
                    height={90} // 👈 Le damos más altura para que el texto inclinado no se corte
                    interval={0} // 🚀 LA MAGIA: Obliga a Recharts a mostrar todos los puntos sin saltarse ninguno
                  />
                  <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#10b98130', borderRadius: '12px', color: '#fff' }} itemStyle={{ color: '#34d399', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="pagosRealizados" name="Pagos Acreditados" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPagos)" activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500">No hay datos suficientes</div>
          )}
        </div> */}

        {/* GRÁFICA 2: La nueva (Punto de Equilibrio / Payback) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          
          {/* 🚀 CABECERA Y SIMBOLOGÍA (NUEVO) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Proyección de Retorno (Payback)</h3>
                {/* Un pequeño subtítulo ayuda a dar aún más contexto */}
                <p className="text-xs text-gray-400 mt-0.5">Línea de tiempo para recuperar la inversión inicial</p>
              </div>
            </div>

            {/* 🏷️ LA SIMBOLOGÍA VISUAL */}
            <div className="flex items-center gap-5 bg-black/20 px-4 py-2.5 rounded-xl border border-white/5">
              {/* Símbolo de la Línea Punteada Roja */}
              <div className="flex items-center gap-2">
                <div className="w-5 border-t-2 border-dashed border-red-500"></div>
                <span className="text-sm font-medium text-gray-300">Meta: Capital Invertido</span>
              </div>
              
              {/* Símbolo del Área Morada */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-sm shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                <span className="text-sm font-medium text-gray-300">Progreso: Dinero Acumulado</span>
              </div>
            </div>
          </div>
          
          {/* EL RESTO DE TU GRÁFICA SE QUEDA INTACTO */}
          {paybackChartData.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={paybackChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRecuperado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="mes" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${(val/1000)}k`} />
                  
                  {/* TIP: Formateamos el Tooltip para que diga los nombres amigables también al pasar el mouse */}
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#a855f730', borderRadius: '12px', color: '#fff' }} 
                    formatter={(value, name) => [
                      formatCurrency(value), 
                      name === 'inversion' ? 'Capital Invertido' : 'Dinero Acumulado'
                    ]} 
                    labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                  />
                  
                  {/* Línea Meta del Capital */}
                  <Line type="monotone" dataKey="inversion" name="inversion" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                  {/* Ola del Dinero Recuperado */}
                  <Area type="monotone" dataKey="recuperado" name="recuperado" stroke="#a855f7" strokeWidth={3} fill="url(#colorRecuperado)" activeDot={{ r: 6, fill: '#a855f7', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500">No hay pagos activos proyectados</div>
          )}
        </div>

      </div>
    </div>
  );
};

export default InversionistaDashboard;