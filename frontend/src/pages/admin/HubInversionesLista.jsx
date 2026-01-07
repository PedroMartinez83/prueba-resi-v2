import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, DollarSign, TrendingUp, 
  Filter, Search, Plus, Eye, CheckCircle, Clock
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const HubInversionesLista = () => {
  const navigate = useNavigate();
  
  const [contratos, setContratos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    plan: '',
    status: '',
    busqueda: ''
  });

  useEffect(() => {
    fetchContratos();
  }, [filtros.plan, filtros.status]);

  const fetchContratos = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filtros.plan) params.append('plan', filtros.plan);
      if (filtros.status) params.append('status', filtros.status);
      
      const response = await fetch(`${API_BASE_URL}/admin/inversiones/hub?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error al cargar contratos');

      const data = await response.json();
      setContratos(data.contratos);
      setStats(data.stats);
    } catch (error) {
      console.error('Error:', error);
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
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getModeloLabel = (modelo) => {
    const modelos = {
      'SI_LEGADO': 'SI Legado',
      'PLUS_60': 'PLUS 60',
      'SMART_40': 'SMART 40'
    };
    return modelos[modelo] || modelo;
  };

  const getModeloColor = (modelo) => {
    const colors = {
      'SI_LEGADO': 'from-blue-500 to-indigo-500',
      'PLUS_60': 'from-cyan-500 to-blue-500',
      'SMART_40': 'from-purple-500 to-pink-500'
    };
    return colors[modelo] || 'from-gray-500 to-gray-600';
  };

  const contratosFiltrados = contratos.filter(c => {
    if (!filtros.busqueda) return true;
    const busqueda = filtros.busqueda.toLowerCase();
    return (
      c.inversionista_nombre?.toLowerCase().includes(busqueda) ||
      c.numero_vehiculo?.toString().includes(busqueda) ||
      c.id_inversion?.toString().includes(busqueda)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <p className="text-white text-lg">Cargando contratos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/inversionistas-home')}
              className="glass p-3 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Hub de Inversiones</h1>
              <p className="text-gray-400">Gestión de contratos y pagos</p>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/admin/inversiones/crear')}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Contrato
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="glass rounded-xl p-4 border border-cyan-500/30 bg-cyan-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Total Contratos</p>
                <FileText className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-3xl font-bold text-cyan-400">{stats.total_contratos}</p>
              <p className="text-xs text-gray-400 mt-1">{stats.contratos_activos} activos</p>
            </div>

            <div className="glass rounded-xl p-4 border border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Capital Total</p>
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(stats.capital_total)}
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Rendimiento Total</p>
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {formatCurrency(stats.rendimiento_total)}
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Por Plan</p>
                <CheckCircle className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-sm text-gray-300 space-y-1">
                <p>SI: {stats.contratos_si_legado}</p>
                <p>PLUS: {stats.contratos_plus_60} | SMART: {stats.contratos_smart_40}</p>
              </div>
            </div>

          </div>
        )}

        {/* Filtros y Búsqueda */}
        <div className="glass rounded-2xl p-4 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Búsqueda */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por inversionista, vehículo o ID..."
                  value={filtros.busqueda}
                  onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/30"
                />
              </div>
            </div>

            {/* Filtro por Plan */}
            <select
              value={filtros.plan}
              onChange={(e) => setFiltros({ ...filtros, plan: e.target.value })}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/30"
            >
              <option value="">Todos los planes</option>
              <option value="SI_LEGADO">SI Legado</option>
              <option value="PLUS_60">PLUS 60</option>
              <option value="SMART_40">SMART 40</option>
            </select>

            {/* Filtro por Status */}
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/30"
            >
              <option value="">Todos los estados</option>
              <option value="Activa">Activos</option>
              <option value="Completada">Completados</option>
            </select>

          </div>
        </div>

        {/* Lista de Contratos */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Inversionista</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Plan</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Vehículo/Pool</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Inversión</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Pago Mensual</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Progreso</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {contratosFiltrados.map((contrato) => {
                  const progreso = ((contrato.pagos_realizados / contrato.plazo_para_inversionistas) * 100).toFixed(1);
                  
                  return (
                    <tr key={contrato.id_inversion} className="border-b border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-white font-mono">
                        #{contrato.id_inversion}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="text-white font-medium">{contrato.inversionista_nombre}</p>
                        <p className="text-gray-400 text-xs">{contrato.inversionista_email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getModeloColor(contrato.modelo_negocio)} text-white`}>
                          {getModeloLabel(contrato.modelo_negocio)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {contrato.numero_vehiculo 
                          ? `Veh. ${contrato.numero_vehiculo}` 
                          : 'Pool General'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-400">
                        {formatCurrency(contrato.inversion)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-400">
                        {formatCurrency(contrato.pago_mensual_inversionista)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-400 mb-1">
                            {contrato.pagos_realizados}/{contrato.plazo_para_inversionistas}
                          </span>
                          <div className="w-full bg-white/5 rounded-full h-2">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                              style={{ width: `${progreso}%` }}
                            />
                          </div>
                          <span className="text-xs text-cyan-400 mt-1">{progreso}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/admin/inversiones/${contrato.id_inversion}/detalle`)}
                            className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors border border-cyan-500/30"
                            title="Ver Contrato"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/admin/inversionistas/${contrato.inversionista_id}`)}
                            className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                            title="Ver Inversionista"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {contratosFiltrados.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No se encontraron contratos</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default HubInversionesLista;
