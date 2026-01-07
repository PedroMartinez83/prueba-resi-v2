import React, { useState } from 'react';
import { Search, Phone, CheckCircle, Clock, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

const ConsultarEstado = () => {
  const [telefono, setTelefono] = useState('');
  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConsultar = async (e) => {
    e.preventDefault();
    
    if (!telefono || telefono.length !== 10) {
      setError('Por favor ingresa un teléfono válido de 10 dígitos');
      return;
    }

    setLoading(true);
    setError('');
    setSolicitud(null);

    try {
      const response = await fetch(`/api/solicitudes/estado/${telefono}`);
      const result = await response.json();

      if (result.success && result.solicitud) {
        setSolicitud(result.solicitud);
      } else {
        setError('No se encontró ninguna solicitud con este número de teléfono');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pendiente':
        return <Clock className="text-yellow-500" size={24} />;
      case 'Aprobado':
        return <CheckCircle className="text-green-500" size={24} />;
      case 'Aprobado (a prueba)':
        return <AlertTriangle className="text-orange-500" size={24} />;
      case 'Rechazado':
        return <XCircle className="text-red-500" size={24} />;
      default:
        return <Clock className="text-gray-500" size={24} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Aprobado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Aprobado (a prueba)':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Rechazado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusMessage = (status) => {
    switch (status) {
      case 'Pendiente':
        return {
          title: 'Solicitud en Revisión',
          message: 'Tu solicitud está siendo evaluada por nuestro equipo. Te contactaremos pronto con una respuesta.',
          timeframe: 'Tiempo estimado: 2-3 días hábiles'
        };
      case 'Aprobado':
        return {
          title: '¡Felicidades! Solicitud Aprobada',
          message: 'Tu solicitud ha sido aprobada. Nuestro equipo se pondrá en contacto contigo para completar el proceso de incorporación.',
          timeframe: 'Próximos pasos: Capacitación y entrega de vehículo'
        };
      case 'Aprobado (a prueba)':
        return {
          title: 'Aprobado con Periodo de Prueba',
          message: 'Tu solicitud ha sido aprobada condicionalmente. Tendrás un periodo de prueba para demostrar tu compromiso y habilidades.',
          timeframe: 'Duración de prueba: 30 días'
        };
      case 'Rechazado':
        return {
          title: 'Solicitud No Aprobada',
          message: 'Lamentablemente tu solicitud no fue aprobada en esta ocasión. Puedes volver a aplicar en el futuro.',
          timeframe: 'Puedes aplicar nuevamente en 6 meses'
        };
      default:
        return {
          title: 'Estado Desconocido',
          message: 'No se pudo determinar el estado de tu solicitud.',
          timeframe: ''
        };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Consultar Estado de Solicitud</h1>
              <p className="text-gray-600">Verifica el progreso de tu aplicación como conductor</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => window.location.href = '/solicitar-conductor'}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                ¿Aún no aplicas? Solicita aquí
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Formulario de Consulta */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-blue-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Buscar Mi Solicitud</h2>
            <p className="text-gray-600">Ingresa el teléfono que usaste al aplicar</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Teléfono
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="text-gray-400" size={20} />
                </div>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="3111234567"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Formato: 10 dígitos sin espacios ni guiones
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <XCircle className="text-red-500 mr-2" size={20} />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleConsultar}
              disabled={loading || telefono.length !== 10}
              className={`
                w-full py-3 px-6 rounded-lg font-medium transition-all flex items-center justify-center
                ${loading || telefono.length !== 10
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 transform hover:scale-105'}
              `}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2" size={20} />
                  Consultar Estado
                </>
              )}
            </button>
          </div>
        </div>

        {/* Resultado de la Consulta */}
        {solicitud && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header del resultado */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Solicitud Encontrada</h3>
                  <p className="opacity-90">Aplicante: {solicitud.nombre_completo}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-90">ID de Solicitud</div>
                  <div className="text-lg font-bold">#{solicitud.id}</div>
                </div>
              </div>
            </div>

            {/* Estado Actual */}
            <div className="p-8">
              <div className="flex items-start space-x-4 mb-6">
                {getStatusIcon(solicitud.estatus_solicitud)}
                <div className="flex-1">
                  <div className={`
                    inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mb-3
                    ${getStatusColor(solicitud.estatus_solicitud)}
                  `}>
                    {solicitud.estatus_solicitud}
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-lg font-semibold text-gray-900">
                      {getStatusMessage(solicitud.estatus_solicitud).title}
                    </h4>
                    <p className="text-gray-600">
                      {getStatusMessage(solicitud.estatus_solicitud).message}
                    </p>
                    {getStatusMessage(solicitud.estatus_solicitud).timeframe && (
                      <p className="text-sm text-blue-600 font-medium">
                        {getStatusMessage(solicitud.estatus_solicitud).timeframe}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Información de la Solicitud */}
              <div className="border-t pt-6">
                <h5 className="font-medium text-gray-900 mb-4">Detalles de la Solicitud</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Fecha de solicitud:</span>
                    <div className="font-medium">{formatDate(solicitud.fecha_solicitud)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Teléfono de contacto:</span>
                    <div className="font-medium">{telefono}</div>
                  </div>
                </div>
              </div>

              {/* Próximos Pasos según el Estado */}
              {solicitud.estatus_solicitud === 'Pendiente' && (
                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h6 className="font-medium text-yellow-800 mb-2">🕐 ¿Qué sigue?</h6>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Nuestro equipo está revisando tu documentación</li>
                    <li>• Verificaremos tus referencias familiares</li>
                    <li>• Te contactaremos por teléfono para confirmar datos</li>
                    <li>• Mantén tu teléfono disponible</li>
                  </ul>
                </div>
              )}

              {solicitud.estatus_solicitud === 'Aprobado' && (
                <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                  <h6 className="font-medium text-green-800 mb-2">✅ ¡Siguiente Fase!</h6>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Capacitación de inducción (2 días)</li>
                    <li>• Firma de contrato y documentación</li>
                    <li>• Asignación de vehículo</li>
                    <li>• Inicio de actividades</li>
                  </ul>
                </div>
              )}

              {solicitud.estatus_solicitud === 'Aprobado (a prueba)' && (
                <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h6 className="font-medium text-orange-800 mb-2">⚠️ Periodo de Prueba</h6>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• Demuestra puntualidad y responsabilidad</li>
                    <li>• Mantén el vehículo en buen estado</li>
                    <li>• Cumple con las metas establecidas</li>
                    <li>• Evaluación continua durante 30 días</li>
                  </ul>
                </div>
              )}

              {/* Botón de Nueva Consulta */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    setSolicitud(null);
                    setTelefono('');
                    setError('');
                  }}
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ArrowLeft className="mr-2" size={16} />
                  Consultar otro número
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Información adicional */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="font-medium text-blue-900 mb-3">💡 ¿Necesitas ayuda?</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>• Si no encuentras tu solicitud, verifica que el teléfono sea correcto</p>
            <p>• Para dudas o aclaraciones, contacta a nuestro equipo</p>
            <p>• Mantén actualizada tu información de contacto</p>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>📞 Soporte:</strong> +52 311 123 4567 | 
              <strong> 📧 Email:</strong> reclutamiento@automanager.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultarEstado;