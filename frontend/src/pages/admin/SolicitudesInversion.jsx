import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  TrendingUp
} from 'lucide-react';

const SolicitudesInversion = () => {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [notas, setNotas] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarSolicitudes();
  }, [filtroStatus]);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      const url = filtroStatus 
        ? `/api/admin/inversionistas/solicitudes?status=${filtroStatus}`
        : '/api/admin/inversionistas/solicitudes';
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setSolicitudes(data.solicitudes);
      }
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertirLead = async () => {
    if (!solicitudSeleccionada) return;
    
    setProcesando(true);
    try {
      const response = await fetch(`/api/admin/inversionistas/solicitudes/${solicitudSeleccionada.id}/aprobar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notas_revision: notas })
      });

      const data = await response.json();
      
      if (data.success) {
        // ✨ FLUJO INTELIGENTE: Navegar automáticamente al creador de contratos
        const nuevoInversionistaId = data.inversionista_id;
        const plan = solicitudSeleccionada.plan_interes || 'PLUS_60';
        const monto = solicitudSeleccionada.monto_intencion || 100000;

        alert('✅ Lead convertido a inversionista. Redirigiendo al creador de contratos...');
        
        // Navegar al Hub de Inversiones (Tab 3: Crear Contrato) con datos pre-llenados
        navigate(
          `/admin/inversiones/crear?inversionista_id=${nuevoInversionistaId}&monto=${monto}&plan=${plan}`
        );
        
        setModalAprobar(false);
        setSolicitudSeleccionada(null);
        setNotas('');
      } else {
        alert(data.message || 'Error al convertir lead');
      }
    } catch (error) {
      console.error('Error convirtiendo lead:', error);
      alert('Error al convertir lead a inversionista');
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    if (!solicitudSeleccionada || !motivoRechazo) {
      alert('El motivo de rechazo es obligatorio');
      return;
    }
    
    setProcesando(true);
    try {
      const response = await fetch(`/api/admin/inversionistas/solicitudes/${solicitudSeleccionada.id}/rechazar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ motivo_rechazo: motivoRechazo })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('❌ Solicitud rechazada');
        setModalRechazar(false);
        setSolicitudSeleccionada(null);
        setMotivoRechazo('');
        cargarSolicitudes();
      } else {
        alert(data.message || 'Error al rechazar solicitud');
      }
    } catch (error) {
      console.error('Error rechazando:', error);
      alert('Error al rechazar solicitud');
    } finally {
      setProcesando(false);
    }
  };

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'En Revisión': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Aprobada': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Rechazada': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status}
      </span>
    );
  };

  const solicitudesFiltradas = solicitudes.filter(sol => {
    if (!busqueda) return true;
    const searchLower = busqueda.toLowerCase();
    return (
      sol.nombre_completo?.toLowerCase().includes(searchLower) ||
      sol.email?.toLowerCase().includes(searchLower) ||
      sol.telefono?.includes(searchLower)
    );
  });

  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter(s => s.status === 'Pendiente').length,
    rechazadas: solicitudes.filter(s => s.status === 'Rechazada').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header con Botón Volver */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/inversionistas-home')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-all mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al Dashboard</span>
          </button>
          
          <h1 className="text-4xl font-bold text-white mb-2">
            Solicitudes de Inversión
          </h1>
          <p className="text-gray-400">
            Gestiona las solicitudes recibidas desde el portal público
          </p>
        </div>

        {/* Stats Cards (SIN "Aprobadas") */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          
          <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendientes}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          
          <div className="glass rounded-xl p-4 border border-red-500/30 bg-red-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Rechazadas</p>
                <p className="text-2xl font-bold text-red-400">{stats.rechazadas}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Filtros (SIN "Aprobadas") */}
        <div className="glass rounded-xl p-6 border border-white/10 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, email o teléfono..."
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroStatus('')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroStatus === '' 
                    ? 'bg-cyan-500 text-white' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFiltroStatus('Pendiente')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroStatus === 'Pendiente' 
                    ? 'bg-yellow-500 text-white' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFiltroStatus('Rechazada')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroStatus === 'Rechazada' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Rechazadas
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Solicitudes */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400 mt-4">Cargando solicitudes...</p>
          </div>
        ) : solicitudesFiltradas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No se encontraron solicitudes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {solicitudesFiltradas.map((solicitud) => (
              <div 
                key={solicitud.id} 
                className={`glass rounded-xl p-6 border hover:border-cyan-500/30 transition-all ${
                  solicitud.status === 'Pendiente' 
                    ? 'border-yellow-500/30 animate-pulse' 
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{solicitud.nombre_completo}</h3>
                      {getStatusBadge(solicitud.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(solicitud.fecha_solicitud)}
                      </span>
                      {solicitud.plan_interes && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                          {solicitud.plan_interes}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {solicitud.status === 'Pendiente' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSolicitudSeleccionada(solicitud);
                          setModalAprobar(true);
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-bold"
                      >
                        Convertir a Inversionista
                      </button>
                      <button
                        onClick={() => {
                          setSolicitudSeleccionada(solicitud);
                          setModalRechazar(true);
                        }}
                        className="px-6 py-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm">{solicitud.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Phone className="w-4 h-4 text-green-400" />
                    <span className="text-sm">{solicitud.telefono}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-bold">{formatCurrency(solicitud.monto_intencion)}</span>
                  </div>
                </div>

                {solicitud.mensaje && (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-purple-400 mt-1" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Mensaje:</p>
                        <p className="text-sm text-gray-300">{solicitud.mensaje}</p>
                      </div>
                    </div>
                  </div>
                )}

                {solicitud.status === 'Rechazada' && solicitud.motivo_rechazo && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-3">
                    <p className="text-xs text-red-400 mb-1">Motivo de rechazo:</p>
                    <p className="text-sm text-gray-300">{solicitud.motivo_rechazo}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Convertir Lead */}
      {modalAprobar && solicitudSeleccionada && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">Convertir a Inversionista</h3>
            <p className="text-gray-300 mb-4">
              ¿Confirmas que deseas convertir el lead de <span className="text-cyan-400 font-bold">{solicitudSeleccionada.nombre_completo}</span> en un inversionista activo?
            </p>
            
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-cyan-400 font-medium mb-2">🚀 Flujo Inteligente Activado</p>
              <p className="text-xs text-gray-400">
                Al confirmar, se creará automáticamente el inversionista en el CRM y serás redirigido al creador de contratos con los datos pre-llenados.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="Agrega notas sobre esta conversión..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalAprobar(false);
                  setSolicitudSeleccionada(null);
                  setNotas('');
                }}
                disabled={procesando}
                className="flex-1 px-4 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConvertirLead}
                disabled={procesando}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium disabled:opacity-50"
              >
                {procesando ? 'Procesando...' : 'Convertir Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rechazar */}
      {modalRechazar && solicitudSeleccionada && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">Rechazar Solicitud</h3>
            <p className="text-gray-300 mb-4">
              ¿Confirmas que deseas rechazar la solicitud de <span className="text-red-400 font-bold">{solicitudSeleccionada.nombre_completo}</span>?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Motivo del rechazo *
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="Explica por qué se rechaza esta solicitud..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalRechazar(false);
                  setSolicitudSeleccionada(null);
                  setMotivoRechazo('');
                }}
                disabled={procesando}
                className="flex-1 px-4 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={procesando || !motivoRechazo}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all font-medium disabled:opacity-50"
              >
                {procesando ? 'Procesando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitudesInversion;