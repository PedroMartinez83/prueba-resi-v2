import React, { useState, useEffect, useMemo } from 'react';
import inversionistaService from '../../services/inversionistaService';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, CheckCircle, XCircle, Clock, 
  Mail, Calendar, ExternalLink, Users, Phone, Building2, FileText, ShieldCheck
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api'; // Ajusta la ruta si es necesario

const SolicitudesRegistroList = () => {
  const navigate = useNavigate();
  
  // 🚀 ESTADOS
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState(''); // '' = Todas, 'Pendiente', 'Aceptada', 'Rechazada'
  const [busqueda, setBusqueda] = useState('');
  
  // Estados para modales (Solo UI por ahora)
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [procesandoAprobacion, setProcesandoAprobacion] = useState(false);
  const [procesandoRechazo, setProcesandoRechazo] = useState(false);

  // 🌐 CARGAR DATOS
  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // 🚀 CAMBIO CLAVE: Usamos la variable dinámica en lugar de localhost fijo
      const response = await fetch(`${API_BASE_URL}/solicitudes-inversionistas/admin/lista`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        const lista = data.data || data.solicitudes || [];
        console.log("🔍 DATA CRUDA DEL BACKEND:", lista[0]);
        setSolicitudes(lista);
      }
    } catch (error) {
      console.error('Error cargando prospectos:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🛠️ UTILIDADES
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Aceptada': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Rechazada': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    // Si viene null o vacío, asumimos Pendiente
    const finalStatus = status || 'Pendiente';
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[finalStatus] || 'bg-gray-500/20 text-gray-400'}`}>
        {finalStatus}
      </span>
    );
  };

  // 🧮 LÓGICA DE FILTROS Y BÚSQUEDA
  const solicitudesFiltradas = useMemo(() => {
    let filtradas = solicitudes;
    
    if (filtroStatus) {
      filtradas = filtradas.filter(s => (s.estado_aceptacion || 'Pendiente') === filtroStatus);
    }
    
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      filtradas = filtradas.filter(sol => {
        return (
          sol.nombre?.toLowerCase().includes(searchLower) ||
          sol.email?.toLowerCase().includes(searchLower) ||
          sol.rfc?.toLowerCase().includes(searchLower)
        );
      });
    }
    return filtradas;
  }, [solicitudes, filtroStatus, busqueda]);

  // 📊 ESTADÍSTICAS
  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter(s => (s.estado_aceptacion || 'Pendiente') === 'Pendiente').length,
    rechazadas: solicitudes.filter(s => s.estado_aceptacion === 'Rechazada').length
  };

  // Componente Auxiliar para renderizar los enlaces a documentos (Estilo Chip)
  const DocumentLink = ({ url, title }) => {
    if (!url) return null;
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 bg-black/20 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 rounded-full transition-all group"
      >
        <FileText className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors whitespace-nowrap">
          {title}
        </span>
        <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-cyan-400 transition-colors" />
      </a>
    );
  };

  const handleAprobar = async () => {
    if (!solicitudSeleccionada) return;

    try {
      setProcesandoAprobacion(true);
      // 🚀 Llamamos al servicio que creaste
      const response = await inversionistaService.aprobarSolicitudRegistro(solicitudSeleccionada.id);

      if (response.success) {
        // 🎉 Éxito
        alert('¡Inversionista aprobado y dado de alta exitosamente!');
        setModalAprobar(false);
        setSolicitudSeleccionada(null);
        
        // Recargamos la tabla para que se actualicen los datos
        cargarSolicitudes(); 
      } else {
        alert(response.message || response.error || 'Error al aprobar la solicitud');
      }
    } catch (error) {
      console.error('❌ Error al aprobar:', error);
      alert('Hubo un error de conexión al intentar aprobar el registro.');
    } finally {
      setProcesandoAprobacion(false);
    }
  };

  const handleRechazar = async () => {
    if (!solicitudSeleccionada || !motivoRechazo) return;

    try {
      setProcesandoRechazo(true);
      const response = await inversionistaService.rechazarSolicitudRegistro(solicitudSeleccionada.id, motivoRechazo);

      if (response.success) {
        alert('Solicitud rechazada correctamente.');
        setModalRechazar(false);
        setSolicitudSeleccionada(null);
        setMotivoRechazo(''); // Limpiamos el campo
        cargarSolicitudes();  // Recargamos la tabla
      } else {
        alert(response.message || response.error || 'Error al rechazar');
      }
    } catch (error) {
      console.error('❌ Error al rechazar:', error);
      alert('Hubo un error de conexión al intentar rechazar el registro.');
    } finally {
      setProcesandoRechazo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* ========================================= */}
        {/* HEADER */}
        {/* ========================================= */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/inversionistas-home')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-all mb-4 w-fit"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al Dashboard</span>
          </button>
          
          <h1 className="text-4xl font-bold text-white mb-2">
            Nuevos Prospectos
          </h1>
          <p className="text-gray-400">
            Revisa y aprueba a los usuarios que desean convertirse en inversionistas.
          </p>
        </div>

        {/* ========================================= */}
        {/* STATS CARDS */}
        {/* ========================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Registros</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          
          <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Por Revisar</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendientes}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          
          <div className="glass rounded-xl p-4 border border-red-500/30 bg-red-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Rechazados</p>
                <p className="text-2xl font-bold text-red-400">{stats.rechazadas}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* ========================================= */}
        {/* FILTROS */}
        {/* ========================================= */}
        <div className="glass rounded-xl p-6 border border-white/10 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, email o RFC..."
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {['', 'Pendiente', 'Aceptada', 'Rechazada'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFiltroStatus(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    filtroStatus === status 
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {status === '' ? 'Todas' : status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================= */}
        {/* LISTA DE SOLICITUDES */}
        {/* ========================================= */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400 mt-4">Cargando prospectos...</p>
          </div>
        ) : solicitudesFiltradas.length === 0 ? (
          <div className="text-center py-12 glass rounded-xl border border-white/10">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No se encontraron solicitudes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {solicitudesFiltradas.map((sol) => (
              <div 
                key={sol.id} 
                className={`glass rounded-xl p-6 border transition-all ${
                  (sol.estado_aceptacion || 'Pendiente') === 'Pendiente' 
                    ? 'border-yellow-500/30' 
                    : 'border-white/10 hover:border-cyan-500/30'
                }`}
              >
                {/* Header del Card */}
                <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white uppercase">{sol.nombre}</h3>
                      {getStatusBadge(sol.estado_aceptacion)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                      <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
                        {sol.tipo_inversionista === 'Persona Moral' ? <Building2 className="w-4 h-4 text-purple-400"/> : <Users className="w-4 h-4 text-cyan-400"/>}
                        {sol.tipo_inversionista}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> Registro: {formatDate(sol.created_at)}
                      </span>
                      <span className="font-mono bg-black/30 px-2 py-1 rounded border border-white/5">
                        RFC: {sol.rfc}
                      </span>
                      <span className="flex items-center gap-1">
                        Direccion: {sol.direccion}
                      </span>
                    </div>
                  </div>
                  
                  {/* Botones de Acción (Solo si está Pendiente) */}
                  {(sol.estado_aceptacion || 'Pendiente') === 'Pendiente' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSolicitudSeleccionada(sol); setModalAprobar(true); }}
                        className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-bold flex items-center gap-2"
                      >
                        <ShieldCheck className="w-5 h-5" /> Aprobar
                      </button>
                      <button
                        onClick={() => { setSolicitudSeleccionada(sol); setModalRechazar(true); }}
                        className="px-5 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>

                {/* Grid de Información y Documentos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Columna 1: Contacto */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Datos de Contacto</h4>
                    <div className="flex items-center gap-3 text-gray-300">
                      <Mail className="w-5 h-5 text-gray-500" />
                      <span className="text-sm">{sol.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <Phone className="w-5 h-5 text-gray-500" />
                      <span className="text-sm">{sol.telefono} {sol.whatsapp ? '(WhatsApp)' : ''}</span>
                    </div>
                    {sol.curp && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <span className="text-xs text-gray-500">CURP:</span>
                        <p className="text-sm text-gray-300 font-mono">{sol.curp}</p>
                      </div>
                    )}
                  </div>

                  {/* Columna 2: Banco */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Datos Bancarios</h4>
                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <p className="text-xs text-gray-500 mb-1">Banco: <span className="text-white font-medium">{sol.banco}</span></p>
                      <p className="text-xs text-gray-500 mb-1">Titular: <span className="text-white font-medium">{sol.nombre_cuenta_banco}</span></p>
                      <p className="text-xs text-gray-500 mb-1">Cuenta: <span className="text-gray-300 font-mono">{sol.cuenta_bancaria || 'N/A'}</span></p>
                      <p className="text-xs text-gray-500">CLABE: <span className="text-cyan-300 font-mono">{sol.clabe}</span></p>
                    </div>
                  </div>

                  {/* Columna 3: Documentos Adjuntos */}
                    
                    {/* Cambiamos el grid por una lista vertical (flex-col) */}
                    {/* Columna 3: Documentos Adjuntos */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Documentos Expediente</h4>
                    
                    {/* 🚀 Cambiamos a flex-wrap para que se acomoden solos como etiquetas */}
                    <div className="flex flex-wrap gap-2">
                      <DocumentLink url={sol.doc_identificacion} title="Identificación" />
                      <DocumentLink url={sol.doc_constancia_fiscal} title="Constancia Fiscal" />
                      <DocumentLink url={sol.doc_comprobante_domicilio} title="Domicilio" />
                      <DocumentLink url={sol.doc_cuenta_banco} title="Cuenta Bancaria" />
                      
                      {/* Exclusivos Moral */}
                      <DocumentLink url={sol.doc_acta_constitutiva} title="Acta Constitutiva" />
                      <DocumentLink url={sol.doc_poder_legal} title="Poder Legal" />
                      <DocumentLink url={sol.doc_id_representante} title="ID Representante" />
                    </div>

                    {/* Mostrar motivo de rechazo si aplica */}
                    {sol.estado_aceptacion === 'Rechazada' && sol.motivo_rechazo && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 mb-1">
                          <XCircle className="w-4 h-4 text-red-400" />
                          <span className="text-xs font-bold text-red-400 uppercase tracking-tight">Motivo del Rechazo:</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed italic">
                          "{sol.motivo_rechazo}"
                        </p>
                      </div>
                    )}
                  </div>
                  </div>

                </div>

            ))}
          </div>
        )}
      </div>

      {/* ========================================= */}
      {/* 🟢 MODAL: APROBAR (UI) */}
      {/* ========================================= */}
      {modalAprobar && solicitudSeleccionada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl shadow-green-500/10">
            <h3 className="text-2xl font-bold text-white mb-2">Aprobar Inversionista</h3>
            <p className="text-gray-300 mb-6 text-sm">
              ¿Confirmas que los documentos y datos de <span className="text-cyan-400 font-bold">{solicitudSeleccionada.nombre}</span> son válidos?
            </p>
            
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-emerald-400 font-medium mb-1">✅ Se creará su cuenta</p>
              <p className="text-xs text-gray-400">
                Al confirmar, se creara su perfil de inversionista, para asignar su correo y contraseña se debera ingresar a su perfil para generarlos.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalAprobar(false)}
                className="flex-1 px-4 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleAprobar}
                disabled={procesandoAprobacion}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium disabled:opacity-50 flex justify-center items-center"
              >
                {procesandoAprobacion ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  'Confirmar y Crear'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 🔴 MODAL: RECHAZAR (UI) */}
      {/* ========================================= */}
      {modalRechazar && solicitudSeleccionada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl shadow-red-500/10">
            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <XCircle className="w-6 h-6 text-red-500" /> Rechazar Prospecto
            </h3>
            <p className="text-gray-300 mb-4 text-sm">
              Indica el motivo por el cual se rechaza a este usuario.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Motivo del rechazo *</label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-red-500/50 outline-none"
                placeholder="Ej. Documentación borrosa o ilegible..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalRechazar(false)}
                className="flex-1 px-4 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={!motivoRechazo || procesandoRechazo}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all font-bold disabled:opacity-50 flex justify-center items-center"
              >
                {procesandoRechazo ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Rechazando...
                  </>
                ) : (
                  'Confirmar Rechazo'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitudesRegistroList;