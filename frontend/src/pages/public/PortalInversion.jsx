import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar,
  CheckCircle,
  Phone,
  Mail,
  User,
  MessageSquare,
  ArrowRight,
  Shield,
  Zap,
  Target
} from 'lucide-react';

const PortalInversion = () => {
  const [montoInversion, setMontoInversion] = useState(100000);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    nombre_completo: '',
    email: '',
    telefono: '',
    whatsapp: '',
    plan_interes: '',
    experiencia_inversion: '',
    como_nos_conocio: '',
    mensaje: ''
  });

  // Cálculos Plan PLUS 60
  const pagoMensualPlus = montoInversion * 0.03;
  const utilidadPlus = montoInversion * 0.60;
  const totalPlus = montoInversion + utilidadPlus;
  const roiAnualPlus = 13.6;

  // Cálculos Plan SMART 40
  const pagoMensualSmart = montoInversion * 0.04;
  const utilidadSmart = montoInversion * 0.40;
  const totalSmart = montoInversion + utilidadSmart;
  const roiAnualSmart = 13.7;

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.nombre_completo) newErrors.nombre_completo = 'El nombre es requerido';
    if (!formData.email) newErrors.email = 'El email es requerido';
    if (!formData.telefono) newErrors.telefono = 'El teléfono es requerido';
    if (formData.telefono && formData.telefono.length !== 10) {
      newErrors.telefono = 'El teléfono debe tener 10 dígitos';
    }
    if (!formData.plan_interes) newErrors.plan_interes = 'Selecciona un plan de interés';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/admin/inversionistas/registro-publico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          monto_intencion: montoInversion,
          whatsapp: formData.whatsapp || formData.telefono
        })
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
        window.scrollTo(0, 0);
      } else {
        alert(result.message || 'Error al enviar solicitud');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full mx-auto mb-6 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            ¡Solicitud Enviada Exitosamente!
          </h1>
          <p className="text-gray-300 mb-6">
            Hemos recibido tu solicitud de inversión por <span className="text-cyan-400 font-bold">{formatCurrency(montoInversion)}</span> en el plan <span className="text-purple-400 font-bold">{formData.plan_interes}</span>.
          </p>
          <p className="text-gray-400 mb-8">
            Nuestro equipo revisará tu solicitud y te contactaremos en las próximas 24-48 horas.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({
                nombre_completo: '',
                email: '',
                telefono: '',
                whatsapp: '',
                plan_interes: '',
                experiencia_inversion: '',
                como_nos_conocio: '',
                mensaje: ''
              });
              setMontoInversion(100000);
            }}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            Nueva Solicitud
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Patrón de fondo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">AM</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AutoManager</h1>
                <p className="text-gray-400 text-sm">Portal de Inversiones</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12">
        
        {/* SECCIÓN 1: HOOK / PITCH */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Planes de Inversión de
            <span className="block mt-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Alto Rendimiento
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            La rentabilidad de los bancos (2-4% anual) no es suficiente. 
            <br />
            <span className="text-cyan-400 font-semibold">AutoManager ofrece 13.6% - 13.7% anual</span> con pagos mensuales.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <div className="flex items-center gap-2 text-green-400">
              <Shield className="w-5 h-5" />
              <span className="font-medium">Inversión Segura</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <Zap className="w-5 h-5" />
              <span className="font-medium">Pagos Mensuales</span>
            </div>
            <div className="flex items-center gap-2 text-purple-400">
              <Target className="w-5 h-5" />
              <span className="font-medium">Alto Retorno</span>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: COMPARACIÓN DE PLANES */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Elige tu Plan de Inversión
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Plan PLUS 60 */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-md rounded-2xl border border-green-500/30 p-8 hover:border-green-400/50 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/20">
              <div className="inline-block px-4 py-2 bg-green-500/20 rounded-full mb-4">
                <span className="text-green-400 font-bold text-sm">LARGO PLAZO</span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">PLAN PLUS 60</h3>
              <p className="text-gray-300 mb-6">Maximiza tu ganancia total</p>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Utilidad Total:</span>
                  <span className="text-2xl font-bold text-green-400">+60%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Pago Mensual:</span>
                  <span className="text-xl font-bold text-white">~3.0%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Plazo:</span>
                  <span className="text-xl font-bold text-white">53 Meses</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">ROI Anual:</span>
                  <span className="text-xl font-bold text-green-400">{roiAnualPlus}%</span>
                </div>
              </div>
              
              <div className="border-t border-white/10 pt-6">
                <p className="text-sm text-gray-400">
                  ✓ Ideal para inversiones a largo plazo
                  <br />
                  ✓ Mayor retorno total sobre inversión
                  <br />
                  ✓ Flujo mensual estable
                </p>
              </div>
            </div>

            {/* Plan SMART 40 */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-md rounded-2xl border border-purple-500/30 p-8 hover:border-purple-400/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20">
              <div className="inline-block px-4 py-2 bg-purple-500/20 rounded-full mb-4">
                <span className="text-purple-400 font-bold text-sm">RETORNO ÁGIL</span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">PLAN SMART 40</h3>
              <p className="text-gray-300 mb-6">Maximiza tu flujo mensual</p>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Utilidad Total:</span>
                  <span className="text-2xl font-bold text-purple-400">+40%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Pago Mensual:</span>
                  <span className="text-xl font-bold text-white">~4.0%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Plazo:</span>
                  <span className="text-xl font-bold text-white">35 Meses</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">ROI Anual:</span>
                  <span className="text-xl font-bold text-purple-400">{roiAnualSmart}%</span>
                </div>
              </div>
              
              <div className="border-t border-white/10 pt-6">
                <p className="text-sm text-gray-400">
                  ✓ Retorno más rápido de capital
                  <br />
                  ✓ Mayor liquidez mensual
                  <br />
                  ✓ Plazo más corto
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: SIMULADOR INTERACTIVO */}
        <div className="mb-16">
          <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 p-8 max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-8">
              Simulador de Inversión
            </h2>
            
            <div className="mb-8">
              <label className="block text-lg font-medium text-gray-300 mb-4">
                Monto de Inversión: <span className="text-cyan-400 font-bold">{formatCurrency(montoInversion)}</span>
              </label>
              <input
                type="range"
                min="10000"
                max="1000000"
                step="10000"
                value={montoInversion}
                onChange={(e) => setMontoInversion(parseInt(e.target.value))}
                className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(6, 182, 212) 0%, rgb(168, 85, 247) ${((montoInversion - 10000) / (1000000 - 10000)) * 100}%, rgba(255,255,255,0.1) ${((montoInversion - 10000) / (1000000 - 10000)) * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              <div className="flex justify-between text-sm text-gray-500 mt-2">
                <span>$10,000</span>
                <span>$1,000,000</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Resultados Plan PLUS 60 */}
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-xl border border-green-500/30 p-6">
                <h3 className="text-xl font-bold text-green-400 mb-4">PLAN PLUS 60</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Tu Pago Mensual</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(pagoMensualPlus)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Tu Utilidad Total</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(utilidadPlus)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total a Recibir</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(totalPlus)}</p>
                  </div>
                </div>
              </div>

              {/* Resultados Plan SMART 40 */}
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                <h3 className="text-xl font-bold text-purple-400 mb-4">PLAN SMART 40</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Tu Pago Mensual</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(pagoMensualSmart)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Tu Utilidad Total</p>
                    <p className="text-2xl font-bold text-purple-400">{formatCurrency(utilidadSmart)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total a Recibir</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(totalSmart)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: FORMULARIO DE REGISTRO */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 p-8">
            <h2 className="text-3xl font-bold text-white text-center mb-2">
              Solicita tu Contrato
            </h2>
            <p className="text-gray-400 text-center mb-8">
              Únete a AutoManager hoy y comienza a recibir rendimientos
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre Completo *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input
                      type="text"
                      value={formData.nombre_completo}
                      onChange={(e) => handleInputChange('nombre_completo', e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                      placeholder="Juan Pérez García"
                    />
                  </div>
                  {errors.nombre_completo && (
                    <p className="text-red-400 text-xs mt-1">{errors.nombre_completo}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                      placeholder="juan@email.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Teléfono (WhatsApp) *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => handleInputChange('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                      placeholder="3111234567"
                    />
                  </div>
                  {errors.telefono && (
                    <p className="text-red-400 text-xs mt-1">{errors.telefono}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Monto de Interés
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input
                      type="text"
                      value={formatCurrency(montoInversion)}
                      disabled
                      className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Del simulador arriba</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Plan Preferido *
                </label>
                <div className="grid md:grid-cols-3 gap-3">
                  {['PLUS 60', 'SMART 40', 'No estoy seguro'].map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => handleInputChange('plan_interes', plan)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.plan_interes === plan
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                      }`}
                    >
                      <div className="font-medium">{plan}</div>
                    </button>
                  ))}
                </div>
                {errors.plan_interes && (
                  <p className="text-red-400 text-xs mt-1">{errors.plan_interes}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ¿Ha invertido antes? (opcional)
                </label>
                <textarea
                  value={formData.experiencia_inversion}
                  onChange={(e) => handleInputChange('experiencia_inversion', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                  placeholder="Ej: Sí, he invertido en bienes raíces..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ¿Cómo nos conociste? (opcional)
                </label>
                <input
                  type="text"
                  value={formData.como_nos_conocio}
                  onChange={(e) => handleInputChange('como_nos_conocio', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                  placeholder="Ej: Referencia, redes sociales, búsqueda en Google..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mensaje (opcional)
                </label>
                <textarea
                  value={formData.mensaje}
                  onChange={(e) => handleInputChange('mensaje', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                  placeholder="Cuéntanos más sobre tus objetivos de inversión..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  !loading
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                    : 'bg-white/10 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Solicitar Contrato
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative bg-black/20 backdrop-blur-sm border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-gray-500 text-sm">
            Desarrollado por <span className="text-cyan-400">somoslazaro.marketing</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortalInversion;