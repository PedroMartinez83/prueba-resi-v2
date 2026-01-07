import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  DollarSign,
  Calendar,
  TrendingUp,
  User,
  Car,
  FileText,
  AlertCircle,
  Check
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const HubInversiones = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Obtener parámetros de la URL
  const inversionistaIdParam = searchParams.get('inversionista_id');
  const montoParam = searchParams.get('monto');
  const planParam = searchParams.get('plan');

  // Estados del formulario
  const [loading, setLoading] = useState(false);
  const [inversionistas, setInversionistas] = useState([]);
  const [vehiculosDisponibles, setVehiculosDisponibles] = useState([]);
  const [procesando, setProcesando] = useState(false);

  // Datos del formulario
  const [formData, setFormData] = useState({
    inversionista_id: inversionistaIdParam || '',
    vehiculo_id: '',
    tipo_inversion: 'vehiculo_especifico',
    modelo_negocio: planParam || 'PLUS_60',
    monto_inversion: montoParam || '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    notas: '',
    valor_factura: ''
  });

  // Configuración de planes
  const planesConfig = {
    'SI_LEGADO': {
      label: 'SI Legado',
      descripcion: 'Plan heredado con flujos mensuales fijos',
      plazo: 62,
      tasa_mensual: 0.027419,
      color: 'from-blue-500 to-indigo-500'
    },
    'PLUS_60': {
      label: 'PLUS 60',
      descripcion: 'Plan premium 60 meses - 60% utilidad',
      plazo: 60,
      multiplicador: 1.60,
      color: 'from-cyan-500 to-blue-500'
    },
    'SMART_40': {
      label: 'SMART 40',
      descripcion: 'Plan inteligente 40 meses - 40% utilidad',
      plazo: 40,
      multiplicador: 1.40,
      color: 'from-purple-500 to-pink-500'
    }
  };

  useEffect(() => {
    cargarInversionistas();
    cargarVehiculosDisponibles();
  }, []);

  // Calcular métricas del simulador
  const calcularMetricas = () => {
    const monto = parseFloat(formData.monto_inversion) || 0;
    const plan = planesConfig[formData.modelo_negocio];
    
    if (!plan || monto === 0) {
      return {
        pagoMensual: 0,
        totalRecibir: 0,
        plazo: 0,
        roi: 0
      };
    }

    let pagoMensual = 0;
    let totalRecibir = 0;

    if (formData.modelo_negocio === 'SI_LEGADO') {
      // SI Legado: flujo fijo mensual
      pagoMensual = monto * plan.tasa_mensual;
      totalRecibir = pagoMensual * plan.plazo;
    } else {
      // AutoManager (PLUS/SMART): multiplicador
      totalRecibir = monto * plan.multiplicador;
      pagoMensual = totalRecibir / plan.plazo;
    }

    const roi = ((totalRecibir - monto) / monto) * 100;

    return {
      pagoMensual: pagoMensual.toFixed(2),
      totalRecibir: totalRecibir.toFixed(2),
      plazo: plan.plazo,
      roi: roi.toFixed(2)
    };
  };

  const metricas = calcularMetricas();

  const cargarInversionistas = async () => {
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

  const cargarVehiculosDisponibles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/inversiones/vehiculos-disponibles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Vehículos cargados:', data);
        setVehiculosDisponibles(data.vehiculos || []);
      } else {
        console.error('❌ Error HTTP:', response.status);
      }
    } catch (error) {
      console.error('❌ Error cargando vehículos:', error);
    }
  };

  const handleVehiculoChange = (e) => {
    const vehiculoId = e.target.value;
    
    // Si seleccionó un vehículo Y el plan es SI_LEGADO, auto-rellenar valor_factura
    if (vehiculoId && formData.modelo_negocio === 'SI_LEGADO') {
      const vehiculoSeleccionado = vehiculosDisponibles.find(
        v => v.numero_de_serie_vehiculo === vehiculoId
      );
      
      if (vehiculoSeleccionado && vehiculoSeleccionado.precio_compra > 0) {
        setFormData(prev => ({
          ...prev,
          vehiculo_id: vehiculoId,
          valor_factura: vehiculoSeleccionado.precio_compra
        }));
        console.log('💰 Auto-rellenado valor_factura:', vehiculoSeleccionado.precio_compra);
      } else {
        setFormData(prev => ({
          ...prev,
          vehiculo_id: vehiculoId
        }));
      }
    } else {
      // Para PLUS_60 y SMART_40, solo actualizar el ID sin valor_factura
      setFormData(prev => ({
        ...prev,
        vehiculo_id: vehiculoId,
        valor_factura: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.inversionista_id) {
      alert('❌ Selecciona un inversionista');
      return;
    }

    if (!formData.monto_inversion || parseFloat(formData.monto_inversion) <= 0) {
      alert('❌ Ingresa un monto de inversión válido');
      return;
    }

    if (formData.modelo_negocio === 'SI_LEGADO' && !formData.vehiculo_id) {
      alert('❌ El plan SI Legado requiere un vehículo específico');
      return;
    }

    setProcesando(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/inversiones/crear-contrato`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          monto_inversion: parseFloat(formData.monto_inversion),
          vehiculo_id: formData.modelo_negocio === 'SI_LEGADO' ? formData.vehiculo_id : null,
          valor_factura: formData.valor_factura ? parseFloat(formData.valor_factura) : null
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('✅ Contrato creado exitosamente');
        navigate(`/admin/inversionistas/${formData.inversionista_id}`);
      } else {
        alert(`❌ Error: ${data.message || 'No se pudo crear el contrato'}`);
      }
    } catch (error) {
      console.error('Error creando contrato:', error);
      alert('❌ Error al crear el contrato');
    } finally {
      setProcesando(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="glass p-3 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Plus className="w-8 h-8 text-green-400" />
                Crear Nuevo Contrato
              </h1>
              <p className="text-gray-400">Genera un contrato de inversión con simulación automática</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Card: Selección de Inversionista y Plan */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-6 h-6 text-cyan-400" />
              Información del Contrato
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Inversionista */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Inversionista *
                </label>
                <select
                  value={formData.inversionista_id}
                  onChange={(e) => setFormData({...formData, inversionista_id: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                  required
                >
                  <option value="">Seleccionar inversionista</option>
                  {inversionistas.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.nombre} - {inv.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan de Inversión */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Plan de Inversión *
                </label>
                <select
                  value={formData.modelo_negocio}
                  onChange={(e) => {
                    const nuevoPlan = e.target.value;
                    setFormData({
                      ...formData, 
                      modelo_negocio: nuevoPlan,
                      vehiculo_id: '',
                      valor_factura: ''
                    });
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                >
                  {Object.entries(planesConfig).map(([key, plan]) => (
                    <option key={key} value={key}>
                      {plan.label} - {plan.plazo} meses
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {planesConfig[formData.modelo_negocio]?.descripcion}
                </p>
              </div>

            </div>

            {/* Vehículo (solo para SI_LEGADO) */}
            {formData.modelo_negocio === 'SI_LEGADO' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Car className="w-4 h-4 inline mr-1" />
                  Vehículo *
                </label>
                <select
                  value={formData.vehiculo_id}
                  onChange={handleVehiculoChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                  required
                >
                  <option value="">Seleccionar vehículo</option>
                  {vehiculosDisponibles.map(veh => (
                    <option key={veh.id} value={veh.numero_de_serie_vehiculo}>
                      {veh.numero_vehiculo} - {veh.marca || 'Sin marca'} {veh.modelo || 'Sin modelo'} ({veh.ano || 'N/A'})
                      {veh.precio_compra > 0 && ` - ${formatCurrency(veh.precio_compra)}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  ℹ️ Plan SI Legado: Contrato 1-a-1 con vehículo específico
                </p>
              </div>
            )}

            {/* Mensaje para PLUS_60 / SMART_40 */}
            {(formData.modelo_negocio === 'PLUS_60' || formData.modelo_negocio === 'SMART_40') && (
              <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-cyan-400 text-sm">
                  ℹ️ Este plan es de <strong>Pool General</strong>. La inversión no se asigna a un vehículo específico.
                </p>
              </div>
            )}

          </div>

          {/* Card: Términos Financieros */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-400" />
              Términos Financieros
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monto de Inversión *
                </label>
                <input
                  type="number"
                  value={formData.monto_inversion}
                  onChange={(e) => setFormData({...formData, monto_inversion: e.target.value})}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                  required
                />
              </div>

              {/* Valor Factura (solo para SI_LEGADO) */}
              {formData.modelo_negocio === 'SI_LEGADO' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor Factura del Vehículo *
                  </label>
                  <input
                    type="number"
                    value={formData.valor_factura}
                    onChange={(e) => setFormData({...formData, valor_factura: e.target.value})}
                    placeholder="Auto-rellenado del vehículo"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    💡 Se auto-rellena del vehículo seleccionado. Puedes editarlo si incluye gastos adicionales.
                  </p>
                </div>
              )}

              {/* Fecha Inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({...formData, fecha_inicio: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                  required
                />
              </div>

            </div>

            {/* Notas */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notas Adicionales (opcional)
              </label>
              <textarea
                value={formData.notas}
                onChange={(e) => setFormData({...formData, notas: e.target.value})}
                rows={3}
                placeholder="Agrega observaciones sobre este contrato..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Simulador de Resultados */}
          <div className={`glass rounded-2xl p-6 border border-white/10 bg-gradient-to-r ${planesConfig[formData.modelo_negocio]?.color} bg-opacity-10`}>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              Simulación del Contrato
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div className="text-center p-4 bg-white/10 rounded-lg">
                <p className="text-gray-300 text-sm mb-1">Pago Mensual</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {formatCurrency(metricas.pagoMensual)}
                </p>
              </div>

              <div className="text-center p-4 bg-white/10 rounded-lg">
                <p className="text-gray-300 text-sm mb-1">Total a Recibir</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(metricas.totalRecibir)}
                </p>
              </div>

              <div className="text-center p-4 bg-white/10 rounded-lg">
                <p className="text-gray-300 text-sm mb-1">Plazo</p>
                <p className="text-2xl font-bold text-purple-400">
                  {metricas.plazo} meses
                </p>
              </div>

              <div className="text-center p-4 bg-white/10 rounded-lg">
                <p className="text-gray-300 text-sm mb-1">ROI</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {metricas.roi}%
                </p>
              </div>

            </div>

            {parseFloat(formData.monto_inversion) > 0 && (
              <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-cyan-400 text-sm font-medium mb-2">
                  <Check className="w-4 h-4 inline mr-1" />
                  Resumen del Contrato
                </p>
                <p className="text-gray-300 text-sm">
                  Al invertir <span className="text-white font-bold">{formatCurrency(formData.monto_inversion)}</span> en el plan{' '}
                  <span className="text-cyan-400 font-bold">{planesConfig[formData.modelo_negocio]?.label}</span>, 
                  el inversionista recibirá <span className="text-green-400 font-bold">{formatCurrency(metricas.pagoMensual)}</span> mensuales 
                  durante <span className="text-purple-400 font-bold">{metricas.plazo} meses</span>, 
                  totalizando <span className="text-green-400 font-bold">{formatCurrency(metricas.totalRecibir)}</span>.
                </p>
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-4 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all font-medium"
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={procesando}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {procesando ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Procesando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  Crear Contrato
                </span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default HubInversiones;
