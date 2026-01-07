import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Plus, 
  Eye, 
  Filter,
  TrendingUp,
  DollarSign,
  FileText,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  UserPlus
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const Inversionistas = () => {
  const navigate = useNavigate();
  const [inversionistas, setInversionistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [showNewModal, setShowNewModal] = useState(false);

  // Stats globales
  const [stats, setStats] = useState({
    total: 0,
    activos: 0,
    inactivos: 0,
    potenciales: 0,
    totalInvertido: 0
  });

  useEffect(() => {
    fetchInversionistas();
  }, []);

  const fetchInversionistas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/admin/inversionistas`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar inversionistas');
      }

      const data = await response.json();
      const inversionistasArray = data.inversionistas || [];
      console.log('📊 Inversionistas cargados:', inversionistasArray.length);

      setInversionistas(inversionistasArray);
      
      // Calcular estadísticas
      const activos = inversionistasArray.filter(inv => inv.status === 'Activo');
      const potenciales = inversionistasArray.filter(inv => inv.status === 'Potencial');
      const totalInvertido = inversionistasArray.reduce((sum, inv) => {
        return sum + (parseFloat(inv.monto_total_invertido) || 0);
      }, 0);
      
      setStats({
        total: inversionistasArray.length,
        activos: activos.length,
        inactivos: inversionistasArray.filter(inv => inv.status === 'Inactivo').length,
        potenciales: potenciales.length,
        totalInvertido
      });

      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar inversionistas
  const inversionistasFiltrados = inversionistas.filter(inv => {
    const matchSearch = searchTerm === '' || 
      inv.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.telefono?.includes(searchTerm);

    const matchEstado = filtroEstado === 'todos' || inv.status === filtroEstado;
    const matchTipo = filtroTipo === 'todos' || inv.tipo_inversionista === filtroTipo;

    return matchSearch && matchEstado && matchTipo;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  const handleVerDetalle = (id) => {
    navigate(`/admin/inversionistas/${id}`);
  };

 const handleConvertirACliente = async (inversionista) => {
    if (window.confirm(`¿Convertir a ${inversionista.nombre} en cliente activo y crear un contrato?`)) {
      try {
        const token = localStorage.getItem('token');
        
        // Actualizar estado a Activo
        const response = await fetch(`${API_BASE_URL}/admin/inversionistas/${inversionista.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'Activo' })
        });

        if (response.ok) {
          alert('✅ Inversionista convertido a Activo. El Hub de Inversiones estará disponible próximamente.');
          fetchInversionistas(); // Recargar lista
        } else {
          throw new Error('Error en la respuesta del servidor');
        }
      } catch (error) {
        alert('❌ Error al convertir inversionista');
        console.error(error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <p className="text-white text-lg">Cargando inversionistas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 border border-red-500/30 max-w-md w-full">
          <div className="flex items-center space-x-3 text-red-400 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h3 className="text-xl font-bold">Error</h3>
          </div>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={fetchInversionistas}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/admin/inversionistas-home')}
              className="glass p-3 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-all"
              title="Volver al Dashboard de Inversionistas"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Users className="w-8 h-8 text-cyan-400" />
                CRM de Inversionistas
              </h1>
              <p className="text-gray-400">Gestión completa de inversionistas y contratos</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setFiltroEstado('Potencial');
                window.scrollTo({ top: 400, behavior: 'smooth' });
              }}
              className="px-6 py-3 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all font-medium flex items-center gap-2 border border-yellow-500/30"
            >
              <AlertCircle className="w-5 h-5" />
              Ver Solicitudes ({stats.potenciales})
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all font-medium flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nuevo Inversionista
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass rounded-xl p-4 border border-cyan-500/30 bg-cyan-500/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Total</p>
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-cyan-400">{stats.total}</p>
          </div>

          <div className="glass rounded-xl p-4 border border-green-500/30 bg-green-500/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Activos</p>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-green-400">{stats.activos}</p>
          </div>

          <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Potenciales</p>
              <UserPlus className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-yellow-400">{stats.potenciales}</p>
          </div>

          <div className="glass rounded-xl p-4 border border-purple-500/30 bg-purple-500/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Capital Total</p>
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-purple-400">{formatCurrency(stats.totalInvertido)}</p>
          </div>

          <div className="glass rounded-xl p-4 border border-gray-500/30 bg-gray-500/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Inactivos</p>
              <AlertCircle className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-400">{stats.inactivos}</p>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="glass rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm font-medium">Filtro Rápido:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroEstado('todos')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroEstado === 'todos'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFiltroEstado('Activo')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroEstado === 'Activo'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Activos
              </button>
              <button
                onClick={() => setFiltroEstado('Potencial')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroEstado === 'Potencial'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Potenciales (Leads)
              </button>
              <button
                onClick={() => setFiltroEstado('Inactivo')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroEstado === 'Inactivo'
                    ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Inactivos
              </button>
            </div>
          </div>
        </div>

        {/* Filtros y Búsqueda */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Búsqueda */}
            <div className="md:col-span-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Filtro Tipo */}
            <div>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer"
              >
                <option value="todos">Todos los tipos</option>
                <option value="Individual">Individual</option>
                <option value="Persona Física">Persona Física</option>
                <option value="Persona Moral">Persona Moral</option>
              </select>
            </div>

          </div>

          {/* Resultados de búsqueda */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Mostrando {inversionistasFiltrados.length} de {inversionistas.length} inversionistas
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Inversionistas */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                    Inversionista
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                    Contacto
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">
                    Total Invertido
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">
                    Contratos
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {inversionistasFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <FileText className="w-12 h-12 mb-3 opacity-50" />
                        <p className="text-lg">No se encontraron inversionistas</p>
                        <p className="text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  inversionistasFiltrados.map((inversionista) => {
                    const esPotencial = inversionista.status === 'Potencial';
                    const tieneContratos = (inversionista.inversiones_activas || 0) > 0;
                    
                    return (
                      <tr 
                        key={inversionista.id}
                        className="border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => !esPotencial && handleVerDetalle(inversionista.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold">
                              {inversionista.nombre?.charAt(0).toUpperCase() || 'I'}
                            </div>
                            <div>
                              <p className="text-white font-medium">{inversionista.nombre || 'Sin nombre'}</p>
                              <p className="text-gray-500 text-xs truncate max-w-[200px]">{inversionista.email || 'Sin email'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-gray-300 text-sm">{formatPhone(inversionista.telefono)}</p>
                            {inversionista.whatsapp && (
                              <p className="text-green-400 text-xs">WhatsApp: {formatPhone(inversionista.whatsapp)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-medium border bg-purple-500/20 text-purple-400 border-purple-500/30">
                            {inversionista.tipo_inversionista || 'No especificado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-cyan-400 font-bold text-xl">
                            {formatCurrency(inversionista.monto_total_invertido)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${
                            tieneContratos 
                              ? 'bg-green-500/10 border-green-500/30' 
                              : 'bg-white/5 border-white/10'
                          }`}>
                            <FileText className={`w-4 h-4 ${tieneContratos ? 'text-green-400' : 'text-gray-400'}`} />
                            <span className={`font-medium ${tieneContratos ? 'text-green-400' : 'text-white'}`}>
                              {inversionista.inversiones_activas || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            inversionista.status === 'Activo'
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : inversionista.status === 'Potencial'
                              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }`}>
                            {inversionista.status || 'Sin estado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {esPotencial ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConvertirACliente(inversionista);
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors border border-green-500/30"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Convertir a Cliente
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVerDetalle(inversionista.id);
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors border border-cyan-500/30"
                            >
                              <Eye className="w-4 h-4" />
                              Ver Detalle
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="glass rounded-2xl p-4 border border-white/10">
          <p className="text-gray-400 text-center text-sm">
            Sistema Auto Manager - Gestión de Inversionistas · Desarrollado por{' '}
            <span className="text-cyan-400">somoslazaro.marketing</span>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Inversionistas;
