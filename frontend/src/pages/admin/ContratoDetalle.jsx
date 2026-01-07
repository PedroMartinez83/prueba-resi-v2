import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, DollarSign, Calendar, User, 
  CheckCircle, Clock, AlertCircle, TrendingUp, Car
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const ContratoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [contrato, setContrato] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchContratoDetalle();
  }, [id]);

  const fetchContratoDetalle = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/inversiones/contratos/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar contrato');
      }

      const data = await response.json();
      setContrato(data.contrato);
      setPagos(data.pagos);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pagado': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Vencido': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getModeloLabel = (modelo) => {
    const modelos = {
      'SI_LEGADO': 'SI Legado',
      'PLUS_60': 'PLUS 60',
      'SMART_40': 'SMART 40'
    };
    return modelos[modelo] || modelo;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <p className="text-white text-lg">Cargando contrato...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !contrato) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 border border-red-500/30 max-w-md w-full">
          <div className="flex items-center space-x-3 text-red-400 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h3 className="text-xl font-bold">Error</h3>
          </div>
          <p className="text-gray-300 mb-6">{error || 'Contrato no encontrado'}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all font-medium"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const progresoGeneral = stats ? (stats.pagos_realizados / stats.total_pagos * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="glass p-3 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Detalle de Contrato</h1>
            <p className="text-gray-400">Contrato #{contrato.id_inversion}</p>
          </div>
        </div>

        {/* Info del Contrato */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Inversionista */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-cyan-400" />
                <p className="text-gray-400 text-sm">Inversionista</p>
              </div>
              <p className="text-white font-bold text-lg">{contrato.inversionista_nombre}</p>
              <p className="text-gray-400 text-sm">{contrato.inversionista_email}</p>
            </div>

            {/* Plan */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <p className="text-gray-400 text-sm">Plan</p>
              </div>
              <p className="text-white font-bold text-lg">{getModeloLabel(contrato.modelo_negocio)}</p>
              <p className="text-gray-400 text-sm">{contrato.plazo_para_inversionistas} meses</p>
            </div>

            {/* Vehículo o Pool */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Car className="w-5 h-5 text-green-400" />
                <p className="text-gray-400 text-sm">Asignación</p>
              </div>
              {contrato.numero_vehiculo ? (
                <>
                  <p className="text-white font-bold text-lg">Veh. {contrato.numero_vehiculo}</p>
                  <p className="text-gray-400 text-sm">{contrato.marca} {contrato.modelo_vehiculo}</p>
                </>
              ) : (
                <p className="text-white font-bold text-lg">Pool General</p>
              )}
            </div>

            {/* Fecha */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-yellow-400" />
                <p className="text-gray-400 text-sm">Fecha de Inicio</p>
              </div>
              <p className="text-white font-bold text-lg">{formatDate(contrato.fecha_de_inicio)}</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs border mt-2 ${
                contrato.status_inversion === 'Activa' 
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}>
                {contrato.status_inversion}
              </span>
            </div>

          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="glass rounded-xl p-4 border border-cyan-500/30 bg-cyan-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Inversión Total</p>
                <DollarSign className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {formatCurrency(contrato.inversion)}
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Pago Mensual</p>
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {formatCurrency(contrato.pago_mensual_inversionista)}
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Total Pagado</p>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(stats.monto_total_pagado)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.pagos_realizados} de {stats.total_pagos} pagos</p>
            </div>

            <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Por Cobrar</p>
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-2xl font-bold text-yellow-400">
                {formatCurrency(stats.monto_total_pendiente)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.pagos_pendientes} pagos pendientes</p>
            </div>

          </div>
        )}

        {/* Barra de Progreso General */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">Progreso General del Contrato</h3>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-gray-400">Completado</span>
            <span className="text-cyan-400 font-bold text-lg">{progresoGeneral}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${progresoGeneral}%` }}
            />
          </div>
        </div>

        {/* Calendario de Pagos */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">Calendario de Pagos</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Mes</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Fecha Programada</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Monto</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Fecha de Pago</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      Mes {pago.mes_pago}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {formatDate(pago.fecha_programada)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-400">
                      {formatCurrency(pago.monto_programado)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(pago.status)}`}>
                        {pago.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {pago.fecha_pago ? formatDate(pago.fecha_pago) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ContratoDetalle;
