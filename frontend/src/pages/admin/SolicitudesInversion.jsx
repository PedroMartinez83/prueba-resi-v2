import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, CheckCircle, XCircle, Clock, 
  DollarSign, Mail, Calendar, TrendingUp, FileImage, ExternalLink, Landmark, UploadCloud, Loader2, Settings, Save 
} from 'lucide-react';

import inversionistaService from '@/services/inversionistaService';
import adminService from '@/services/adminService';

const SolicitudesInversion = () => {
  const navigate = useNavigate();
  
  // 🚀 ESTADOS
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState(''); // '' = Todas, 'Pendiente', 'Rechazada'
  const [busqueda, setBusqueda] = useState('');
  
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [comprobanteDevolucionUrl, setComprobanteDevolucionUrl] = useState('');
  const [isUploadingDev, setIsUploadingDev] = useState(false);
  const [modalConfigBanco, setModalConfigBanco] = useState(false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [configBanco, setConfigBanco] = useState({
    id: 1, // Por defecto asumimos el 1, pero se actualizará al cargar
    banco: '',
    titular: '',
    cuenta: '',
    clabe: '',
    instrucciones: ''
  });

  const BANCOS_MEXICO = [
  "BBVA",
  "Santander",
  "Banorte",
  "Citibanamex",
  "HSBC",
  "Scotiabank",
  "Banco Azteca",
  "BanCoppel",
  "Inbursa",
  "BanBajío",
  "Banregio",
  "Afirme",
  "Invex",
  "Mifel",
  "Banjército",
  "Openbank",
  "Nu México",
  "Mercado Pago",
  "Hey Banco",
  "Klar",
  "Spin by Oxxo",
  "Ualá",
  "Stori",
  "Fondeadora",
  "Albo",
  "Celo",
  "STP",
  "Otro"
].sort();

  // 🌐 CARGAR DATOS
  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      // Traemos todas para poder calcular las estadísticas correctamente
      const response = await fetch('/api/admin/inversionistas/solicitudes', {
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

  const handleAprobar = async () => {
    if (!solicitudSeleccionada) return;
    setProcesando(true);
    
    try {
      // Usando el service en lugar de fetch
      const data = await inversionistaService.aprobarSolicitud(solicitudSeleccionada.id);
      
      if (data.success) {
        alert('✅ Contrato Aprobado y Activo. El inversionista ya puede verlo en su portal.');
        setModalAprobar(false);
        setSolicitudSeleccionada(null);
        cargarSolicitudes(); 
      } else {
        alert(data.message || 'Error al aprobar solicitud');
      }
    } catch (error) {
      alert(`Error de conexión: ${error.message}`);
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    if (!solicitudSeleccionada || !motivoRechazo || !comprobanteDevolucionUrl) {
      alert('Faltan datos obligatorios para rechazar.');
      return;
    }
    
    setProcesando(true);
    try {
      const data = await inversionistaService.rechazarSolicitud( // Asegúrate de que sea tu adminService
        solicitudSeleccionada.id, 
        motivoRechazo,
        comprobanteDevolucionUrl
      );
      
      if (data.success) {
        alert('❌ Solicitud rechazada y reembolso registrado.');
        
        // 🧹 AHORA SÍ: Limpiamos todo y cerramos la ventana
        setModalRechazar(false);
        setSolicitudSeleccionada(null);
        setMotivoRechazo('');
        setComprobanteDevolucionUrl('');
        
        // 🔄 Recargamos la tabla
        cargarSolicitudes();
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setProcesando(false);
    }
  };

  // 2. Función para subir el ticket de devolución
const handleUploadDevolucion = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setIsUploadingDev(true);
  const data = new FormData();
  data.append('file', file);
  data.append('upload_preset', 'inversionistas_docs'); // Ajusta con tus datos de Cloudinary
  data.append('cloud_name', 'dvh2t0afl');

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/dvh2t0afl/image/upload`, {
      method: 'POST',
      body: data
    });
    const fileData = await res.json();
    console.log("Respuesta de Cloudinary:", fileData);
    setComprobanteDevolucionUrl(fileData.secure_url);
  } catch (error) {
    alert('Error al subir el comprobante de devolución');
  } finally {
    setIsUploadingDev(false);
  }
};

// 🟢 ABRIR MODAL Y CARGAR DATOS
  const handleAbrirConfigBanco = async () => {
    setModalConfigBanco(true); // Abrimos el modal rápido para que el usuario vea acción
    try {
      const res = await adminService.getDatosBancariosEmpresa();
      if (res.success && res.datos) {
        setConfigBanco(res.datos); // 👈 Pre-llenamos el formulario
      }
    } catch (error) {
      console.error("Error cargando configuración bancaria:", error);
    }
  };

  // 💾 GUARDAR CAMBIOS
  const handleGuardarConfigBanco = async (e) => {
    e.preventDefault();
    setGuardandoConfig(true);
    try {
      const res = await inversionistaService.updateDatosBancarios(configBanco.id, configBanco);
      if (res.success) {
        alert('✅ Datos bancarios de la empresa actualizados.');
        setModalConfigBanco(false);
      }
    } catch (error) {
      alert(`❌ Error al guardar: ${error.message}`);
    } finally {
      setGuardandoConfig(false);
    }
  };

  // 🛠️ UTILIDADES Y FORMATOS
  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Aceptada': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Rechazada': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status}
      </span>
    );
  };

  // 🧮 LÓGICA DE FILTROS Y BÚSQUEDA
  const solicitudesFiltradas = useMemo(() => {
    let filtradas = solicitudes;
    
    // 1. Filtro por Pestaña
    if (filtroStatus) {
      filtradas = filtradas.filter(s => s.estado_aceptacion === filtroStatus);
    }
    
    // 2. Filtro por Búsqueda (Input)
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      filtradas = filtradas.filter(sol => {
        const nombreCompleto = `${sol.inversionista_nombre || ''} ${sol.inversionista_apellidos || ''}`.toLowerCase();
        return (
          nombreCompleto.includes(searchLower) ||
          sol.inversionista_email?.toLowerCase().includes(searchLower)
        );
      });
    }
    return filtradas;
  }, [solicitudes, filtroStatus, busqueda]);

  // 📊 ESTADÍSTICAS
  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter(s => s.estado_aceptacion === 'Pendiente').length,
    rechazadas: solicitudes.filter(s => s.estado_aceptacion === 'Rechazada').length
  };

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* ========================================= */}
        {/* HEADER CON BOTÓN DE CONFIGURACIÓN BANCARIA */}
        {/* ========================================= */}
        <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/admin/inversionistas-home')}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-all mb-4 w-fit"
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

          {/* 🚀 EL NUEVO BOTÓN */}
          <button
            onClick={handleAbrirConfigBanco}
            className="flex items-center gap-2 px-5 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl transition-all font-medium shadow-lg shadow-cyan-500/10 w-fit"
          >
            <Settings className="w-5 h-5" />
            <span>Configurar Cuenta Receptora</span>
          </button>
        </div>


      {/* ========================================= */}
      {/* 🔴 MODAL: EDITAR DATOS BANCARIOS EMPRESA  */}
      {/* ========================================= */}
      {modalConfigBanco && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-white/10 w-full max-w-lg overflow-hidden shadow-2xl">
            
            {/* Header del Modal */}
            <div className="p-6 border-b border-white/10 bg-cyan-500/5">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <Landmark className="w-7 h-7 text-cyan-400" /> 
                Datos Bancarios (AutoManager)
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                Esta es la cuenta donde los inversionistas depositarán su capital.
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarConfigBanco} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 🚀 TITULAR (Mayúsculas automáticas) */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Titular de la Cuenta *</label>
                    <input
                      type="text"
                      required
                      value={configBanco.titular || ''}
                      onChange={(e) => setConfigBanco({...configBanco, titular: e.target.value.toUpperCase()})}
                      className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white focus:border-cyan-500 outline-none"
                      placeholder="EJ. AUTOMANAGER S.A. DE C.V."
                    />
                  </div>

                  {/* 🚀 BANCO (Lista desplegable) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Banco *</label>
                    <select
                      required
                      value={configBanco.banco || ''}
                      onChange={(e) => setConfigBanco({...configBanco, banco: e.target.value})}
                      className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white focus:border-cyan-500 outline-none cursor-pointer"
                    >
                      <option value="" disabled>Selecciona un banco...</option>
                      {BANCOS_MEXICO.map((bancoOpcion) => (
                        <option key={bancoOpcion} value={bancoOpcion} className="bg-gray-900">{bancoOpcion}</option>
                      ))}
                    </select>
                  </div>

                  {/* 🚀 NÚMERO DE CUENTA (Ahora Obligatorio) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Número de Cuenta *</label>
                    <input
                      type="text"
                      required
                      value={configBanco.cuenta || ''}
                      onChange={(e) => setConfigBanco({...configBanco, cuenta: e.target.value.replace(/\D/g, '')})}
                      className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white font-mono focus:border-cyan-500 outline-none"
                      placeholder="10 dígitos"
                    />
                  </div>

                  {/* 🚀 CUENTA CLABE (Opcional en código, Obligatoria en apariencia) */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-cyan-300 mb-1">Cuenta CLABE *</label>
                    <input
                      type="text"
                      maxLength="18"
                      value={configBanco.clabe || ''}
                      onChange={(e) => setConfigBanco({...configBanco, clabe: e.target.value.replace(/\D/g, '')})}
                      className="w-full px-4 py-2.5 bg-cyan-500/5 border border-cyan-500/30 rounded-lg text-white font-mono tracking-widest focus:border-cyan-400 outline-none"
                      placeholder="18 dígitos"
                    />
                    <p className="text-xs text-gray-500 mt-1">Dígitos actuales: {configBanco.clabe?.length || 0}/18</p>
                  </div>

                  <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Instrucciones Adicionales</label>
                  <textarea
                    rows={2}
                    value={configBanco.instrucciones || ''}
                    onChange={(e) => setConfigBanco({...configBanco, instrucciones: e.target.value})}
                    className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-gray-300 focus:border-cyan-500 outline-none"
                    placeholder="Ej. Poner el nombre completo en el concepto..."
                  />
                </div>
                </div>

                {/* 🔘 BOTONES DE ACCIÓN */}
                <div className="flex gap-3 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setModalConfigBanco(false)}
                    className="flex-1 px-4 py-3 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    // 🧠 LÓGICA DE BLOQUEO:
                    // Se bloquea si: está guardando O falta titular/banco/cuenta
                    // O si escribió algo en CLABE pero no son 18 dígitos.
                    disabled={
                      guardandoConfig || 
                      !configBanco.titular || 
                      !configBanco.banco || 
                      !configBanco.cuenta ||
                      (configBanco.clabe?.length > 0 && configBanco.clabe?.length !== 18)
                    }
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-bold disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {guardandoConfig ? 'Guardando...' : <><Save className="w-4 h-4"/> Guardar Cambios</>}
                  </button>
                </div>
            </form>
          </div>
        </div>
      )}

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
                  placeholder="Buscar por nombre o email..."
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroStatus('')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroStatus === '' 
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFiltroStatus('Pendiente')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroStatus === 'Pendiente' 
                    ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFiltroStatus('Rechazada')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtroStatus === 'Rechazada' 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
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
            <p className="text-gray-400">No se encontraron solicitudes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {solicitudesFiltradas.map((solicitud) => (
              <div 
                key={solicitud.id} 
                className={`glass rounded-xl p-6 border hover:border-cyan-500/30 transition-all ${
                  solicitud.estado_aceptacion === 'Pendiente' 
                    ? 'border-yellow-500/30' 
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">
                        {solicitud.inversionista_nombre} {solicitud.inversionista_apellidos}
                      </h3>
                      {getStatusBadge(solicitud.estado_aceptacion)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(solicitud.created_at)}
                      </span>
                      {solicitud.modelo_negocio && (
                        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded">
                          {solicitud.modelo_negocio}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Botones (Solo si está Pendiente) */}
                  {solicitud.estado_aceptacion === 'Pendiente' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSolicitudSeleccionada(solicitud);
                          setModalAprobar(true);
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-bold"
                      >
                        Aprobar Contrato
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

                {/* Grid de Información de la Solicitud */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="w-5 h-5 text-purple-400" />
                    <span className="text-sm">{solicitud.inversionista_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <DollarSign className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-xs text-gray-500">Monto Solicitado</p>
                      <span className="text-sm font-bold text-white">{formatCurrency(solicitud.monto_invertido)}</span>
                    </div>
                  </div>
                  
                  {/* El famosísimo comprobante */}
                  <div className="flex items-center gap-2 text-gray-300">
                    <FileImage className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-xs text-gray-500">Comprobante de Pago</p>
                      {solicitud.comprobante_url ? (
                        <a 
                          href={solicitud.comprobante_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-sm font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                        >
                          Ver Ticket <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500 italic">No adjuntado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mensaje de Rechazo (Si aplica) */}
                {solicitud.estado_aceptacion === 'Rechazada' && solicitud.motivo_rechazo && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-3">
                    <p className="text-xs font-bold text-red-400 mb-1">Motivo de rechazo:</p>
                    <p className="text-sm text-gray-300">{solicitud.motivo_rechazo}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🟢 Modal Aprobar Contrato */}
      {modalAprobar && solicitudSeleccionada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">Aprobar Contrato</h3>
            <p className="text-gray-300 mb-4">
              ¿Confirmas que el pago de <span className="text-green-400 font-bold">{formatCurrency(solicitudSeleccionada.monto_invertido)}</span> es correcto?
            </p>
            
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-emerald-400 font-medium mb-1">🚀 Activación Inmediata</p>
              <p className="text-xs text-gray-400">
                Al confirmar, el estado de la solicitud pasará a "Aceptada", el contrato quedará Activo en el sistema, y el inversionista verá los rendimientos en su portal.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalAprobar(false);
                  setSolicitudSeleccionada(null);
                }}
                disabled={procesando}
                className="flex-1 px-4 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleAprobar}
                disabled={procesando}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium disabled:opacity-50"
              >
                {procesando ? 'Aprobando...' : 'Aprobar y Activar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalRechazar && solicitudSeleccionada && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="glass rounded-2xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
        <XCircle className="w-6 h-6 text-red-500" /> Rechazar y Reembolsar
      </h3>
      <p className="text-gray-300 mb-6 text-sm">
        Estás rechazando la inversión de <span className="text-red-400 font-bold">{solicitudSeleccionada.inversionista_nombre}</span>. Por política de AutoManager, debes procesar el reembolso primero.
      </p>

      {/* 🏦 SECCIÓN DE DATOS BANCARIOS */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Landmark className="w-4 h-4" /> Datos de Destino (Inversionista)
        </h4>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Titular:</span>
            <span className="text-white font-medium">{solicitudSeleccionada.nombre_cuenta_banco || 'No especificado'}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Banco:</span>
            <span className="text-white font-medium">{solicitudSeleccionada.banco || 'No especificado'}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Cuenta:</span>
            <span className="text-white font-mono tracking-wider">{solicitudSeleccionada.cuenta_bancaria || 'No especificado'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">CLABE:</span>
            <span className="text-white font-mono tracking-wider">{solicitudSeleccionada.clabe || 'No especificado'}</span>
          </div>
        </div>
      </div>

      {/* 💰 FICHA DE REEMBOLSO CRÍTICA */}
<div className="mb-6 bg-gradient-to-r from-red-500/20 to-transparent border-l-4 border-red-500 p-4 rounded-r-xl">
  <p className="text-xs font-bold text-red-400 uppercase mb-1">Total a Devolver:</p>
  <div className="flex items-center justify-between">
    <h2 className="text-3xl font-black text-white tracking-tight">
      {formatCurrency(solicitudSeleccionada.monto_invertido)}
    </h2>
    <div className="text-right">
      <p className="text-[10px] text-gray-400 leading-tight">
        Por política de **AutoManager**,<br />debes procesar el reembolso primero.
      </p>
    </div>
  </div>
</div>

      {/* 📝 MOTIVO DEL RECHAZO */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Motivo del rechazo *</label>
        <textarea
          value={motivoRechazo}
          onChange={(e) => setMotivoRechazo(e.target.value)}
          rows={2}
          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-red-500/50 outline-none"
          placeholder="Ej. El monto recibido no coincide con la solicitud..."
        />
      </div>

      {/* 📸 SUBIDA DE COMPROBANTE DE DEVOLUCIÓN */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-300 mb-2 text-red-400">Comprobante de Reembolso (Obligatorio) *</label>
        {!comprobanteDevolucionUrl ? (
          <div className="relative border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:bg-white/5 transition-colors cursor-pointer">
            <input 
              type="file" 
              onChange={handleUploadDevolucion} 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              disabled={isUploadingDev}
            />
            {isUploadingDev ? (
              <div className="flex items-center justify-center gap-2 text-cyan-400 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" /> Subiendo ticket...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="w-8 h-8 text-gray-500" />
                <span className="text-sm text-gray-400">Click para subir el ticket de transferencia</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-xs text-emerald-400 font-medium italic">Ticket cargado correctamente</span>
            </div>
            <button 
              onClick={() => setComprobanteDevolucionUrl('')}
              className="text-red-400 text-xs hover:underline"
            >
              Cambiar
            </button>
          </div>
        )}
      </div>

      {/* 🔘 ACCIONES */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setModalRechazar(false);
            setSolicitudSeleccionada(null);
            setMotivoRechazo('');
            setComprobanteDevolucionUrl('');
          }}
          className="flex-1 px-4 py-3 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleRechazar}
          disabled={procesando || isUploadingDev || !motivoRechazo || !comprobanteDevolucionUrl}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:shadow-lg hover:shadow-red-500/30 transition-all font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {procesando ? 'Procesando...' : 'Confirmar y Rechazar'}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default SolicitudesInversion;