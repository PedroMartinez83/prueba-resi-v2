// frontend/src/pages/conductor/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../services/api';
import { Link } from 'react-router-dom';
import { 
  Car, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  User, 
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    conductor: null,
    vehiculo: null,
    rentasPendientes: [],
    rentasRecientes: [],
    proximosVencimientos: [],
    estadisticas: {
      totalPendiente: 0,
      rentasVencidas: 0,
      rentasEnTolerancia: 0,
      pagosMesActual: 0
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      
      // Llamadas reales a tus APIs corregidas
      const token = localStorage.getItem('token');
      
    const [miInfo, misRentas, historial] = await Promise.all([
      fetch(`${API_BASE_URL}/conductor/mi-info`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()),
      fetch(`${API_BASE_URL}/conductor/mis-rentas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()),
      fetch(`${API_BASE_URL}/conductor/historial-pagos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json())
    ]);

      // Mapear respuestas reales a la estructura del dashboard
      const realData = {
        conductor: miInfo.conductor,
        vehiculo: miInfo.conductor.vehiculo,
        rentasPendientes: misRentas.rentas || [],
        rentasRecientes: historial.pagos || [],
        estadisticas: {
          totalPendiente: misRentas.totalPendiente || 0,
          rentasVencidas: misRentas.diasVencidos || 0,
          rentasEnTolerancia: misRentas.enTolerancia || 0,
          pagosMesActual: historial.pagos?.reduce((sum, p) => sum + p.MontoTotal, 0) || 0
        }
      };

      setDashboardData(realData);
      
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const { conductor, vehiculo, rentasPendientes, rentasRecientes, estadisticas } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header de bienvenida */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Bienvenido, {conductor?.nombre}
              </h1>
              <p className="text-gray-600 mt-1">
                Vehículo #{vehiculo?.numero} • Tipo de Socio: {conductor?.tipoSocio}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                conductor?.estado === 'Activo' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {conductor?.estado}
              </span>
            </div>
          </div>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Pendiente</p>
                <p className="text-2xl font-bold text-red-600">
                  ${estadisticas.totalPendiente.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Rentas Pendientes</p>
                <p className="text-2xl font-bold text-blue-600">
                  {rentasPendientes.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">En Tolerancia</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {estadisticas.rentasEnTolerancia}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Pagos del Mes</p>
                <p className="text-2xl font-bold text-green-600">
                  ${estadisticas.pagosMesActual.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link 
            to="/conductor/pagos"
            className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-lg shadow transition-colors"
          >
            <div className="flex items-center">
              <CreditCard className="h-8 w-8" />
              <div className="ml-4">
                <h3 className="text-xl font-semibold">Realizar Pago</h3>
                <p className="text-blue-100">Paga tus rentas pendientes</p>
              </div>
            </div>
          </Link>

          <div className="bg-gray-600 hover:bg-gray-700 text-white p-6 rounded-lg shadow transition-colors cursor-pointer">
            <div className="flex items-center">
              <Car className="h-8 w-8" />
              <div className="ml-4">
                <h3 className="text-xl font-semibold">Mi Vehículo</h3>
                <p className="text-gray-100">Ver información del vehículo</p>
              </div>
            </div>
          </div>

          <div className="bg-green-600 hover:bg-green-700 text-white p-6 rounded-lg shadow transition-colors cursor-pointer">
            <div className="flex items-center">
              <Settings className="h-8 w-8" />
              <div className="ml-4">
                <h3 className="text-xl font-semibold">Configuración</h3>
                <p className="text-green-100">Ajustes de cuenta</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Rentas pendientes */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Rentas Pendientes</h2>
                <Link 
                  to="/conductor/pagos"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Ver todas
                </Link>
              </div>
            </div>
            <div className="p-6">
              {rentasPendientes.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">¡Al corriente!</h3>
                  <p className="mt-1 text-sm text-gray-500">No tienes rentas pendientes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rentasPendientes.map((renta) => (
                    <div key={renta.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{renta.folio}</p>
                          <p className="text-sm text-gray-500">
                            Vence: {new Date(renta.fechaVencimiento).toLocaleDateString('es-MX')}
                          </p>
                          {renta.diasParaVencer <= 1 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3 mr-1" />
                              Vence pronto
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            ${renta.monto.toLocaleString()}
                          </p>
                          <Link 
                            to="/conductor/pagos"
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Pagar →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Información del vehículo */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Mi Vehículo</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Número:</span>
                  <span className="font-medium">#{vehiculo?.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vehículo:</span>
                  <span className="font-medium">
                    {vehiculo?.marca} {vehiculo?.modelo} {vehiculo?.año}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Placa:</span>
                  <span className="font-medium">{vehiculo?.placa}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Color:</span>
                  <span className="font-medium">{vehiculo?.color}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Kilometraje:</span>
                  <span className="font-medium">{vehiculo?.kilometraje?.toLocaleString()} km</span>
                </div>
                
                {vehiculo?.proximoMantenimiento && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span className="ml-2 text-sm text-yellow-800">
                        Próximo mantenimiento en {(vehiculo.proximoMantenimiento - vehiculo.kilometraje).toLocaleString()} km
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Últimos pagos */}
          <div className="bg-white rounded-lg shadow lg:col-span-2">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Últimos Pagos</h2>
            </div>
            <div className="p-6">
              {rentasRecientes.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay pagos registrados</p>
              ) : (
                <div className="space-y-3">
                  {rentasRecientes.map((pago) => (
                    <div key={pago.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{pago.folio}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(pago.fechaPago).toLocaleDateString('es-MX')} • {pago.metodoPago}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          ${pago.monto.toLocaleString()}
                        </p>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          Pagada
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
