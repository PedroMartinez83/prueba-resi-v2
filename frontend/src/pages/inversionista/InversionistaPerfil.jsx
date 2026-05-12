import React, { useState, useEffect } from 'react';
import { Mail, Phone, FileText, MapPin, CreditCard, User, Loader2, Download, Edit2, History, Eye, ShieldCheck } from 'lucide-react';
import inversionistaService from '../../services/inversionistaService'; // Ajusta la ruta
import ModalNuevoInversionista from '../../components/inversiones/ModalNuevoInversionista.jsx'; // Ajusta la ruta

// Mini-componente para los documentos
const TarjetaDocumento = ({ titulo, url }) => {
  if (!url) return null;
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noreferrer"
      className="flex items-center gap-3 p-4 bg-black/40 hover:bg-black/60 border border-white/5 hover:border-cyan-500/30 rounded-xl transition-all group"
    >
      <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg group-hover:scale-110 transition-transform">
        <FileText className="w-5 h-5" />
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-medium text-white truncate">{titulo}</p>
        <p className="text-xs text-cyan-400/70 mt-0.5 flex items-center gap-1">
          <Download className="w-3 h-3" /> Ver documento
        </p>
      </div>
    </a>
  );
};

const InversionistaPerfil = () => {
  const [inversionista, setInversionista] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logSeleccionado, setLogSeleccionado] = useState(null);

  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        const res = await inversionistaService.getMiPerfil();
        if (res.success) {
          setInversionista(res.inversionista);
          cargarAuditorias();
        }
      } catch (error) {
        console.error("Error al cargar perfil:", error);
      } finally {
        setCargando(false);
      }
    };

    cargarPerfil();
  }, []);

  const cargarAuditorias = async () => {
  try {
    const res = await inversionistaService.getHistorialAuditoria();
    if (res.success) setAuditLogs(res.logs);
  } catch (error) {
    console.error("Error cargando historial:", error);
  }
};



  // Función auxiliar para formatear teléfono si es necesario
  const formatPhone = (phone) => phone || 'No especificado';

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!inversionista) {
    return (
      <div className="text-center text-gray-400 mt-12">
        <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No se pudo cargar la información de tu perfil.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Mi Perfil</h1>
          <p className="text-gray-400">Consulta y actualiza tu información personal.</p>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl transition-all font-medium"
        >
          <Edit2 className="w-4 h-4" />
          <span className="hidden sm:inline">Editar Información</span>
        </button>
      </div>

      {/* CARD DE INFORMACIÓN PERSONAL */}
      <div className="glass rounded-2xl p-6 md:p-8 border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          
          {/* Info Principal */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-1 text-center sm:text-left">
            {/* Avatar */}
            <div className="w-24 h-24 shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-4xl shadow-lg shadow-cyan-500/20">
              {inversionista.nombre?.charAt(0).toUpperCase() || 'I'}
            </div>
            
            <div className="flex-1 w-full">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">{inversionista.nombre}</h2>
              
              {/* Grid de Datos (1 columna en móvil, 2 en pantallas medianas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-gray-300 bg-white/5 p-3 rounded-xl">
                  <Mail className="w-5 h-5 text-cyan-400 shrink-0" />
                  <span className="truncate">{inversionista.email || 'No especificado'}</span>
                </div>
                
                <div className="flex items-center gap-3 text-gray-300 bg-white/5 p-3 rounded-xl">
                  <Phone className="w-5 h-5 text-green-400 shrink-0" />
                  <span>{formatPhone(inversionista.telefono)}</span>
                </div>
                
                {inversionista.whatsapp && (
                  <div className="flex items-center gap-3 text-gray-300 bg-white/5 p-3 rounded-xl">
                    <Phone className="w-5 h-5 text-green-400 shrink-0" />
                    <span>WhatsApp: {formatPhone(inversionista.whatsapp)}</span>
                  </div>
                )}
                
                {inversionista.rfc && (
                  <div className="flex items-center gap-3 text-gray-300 bg-white/5 p-3 rounded-xl">
                    <FileText className="w-5 h-5 text-purple-400 shrink-0" />
                    <span>RFC: {inversionista.rfc}</span>
                  </div>
                )}
                
                {inversionista.direccion && (
                  <div className="flex items-center gap-3 text-gray-300 bg-white/5 p-3 rounded-xl md:col-span-2">
                    <MapPin className="w-5 h-5 text-red-400 shrink-0" />
                    <span className="break-words text-left">{inversionista.direccion}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Badges de Estado (Se acomodan arriba en móvil, a la derecha en escritorio) */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-center gap-3 w-full lg:w-auto border-t lg:border-t-0 border-white/10 pt-6 lg:pt-0">
            <span className={`px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap ${
              inversionista.status === 'Activo'
                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
            }`}>
              Estado: {inversionista.status || 'Desconocido'}
            </span>
            <span className="px-4 py-2 rounded-full text-sm font-bold border bg-purple-500/10 text-purple-400 border-purple-500/30 whitespace-nowrap">
              {inversionista.tipo_inversionista || 'No definido'}
            </span>
          </div>

        </div>

        {/* INFORMACIÓN BANCARIA */}
        {(inversionista.banco || inversionista.cuenta_bancaria) && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Tus Datos Bancarios (Destino de Rendimientos)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {inversionista.banco && (
                <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                  <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">Banco</p>
                  <p className="text-white font-medium">{inversionista.banco}</p>
                </div>
              )}
              {inversionista.nombre_cuenta_banco && (
                <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                  <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">Nombre de la Cuenta</p>
                  <p className="text-white font-medium">{inversionista.nombre_cuenta_banco}</p>
                </div>
              )}
              {inversionista.cuenta_bancaria && (
                <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                  <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">Cuenta</p>
                  <p className="text-white font-medium font-mono">{inversionista.cuenta_bancaria}</p>
                </div>
              )}
              {inversionista.clabe && (
                <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                  <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">CLABE Interbancaria</p>
                  <p className="text-white font-medium font-mono break-all">{inversionista.clabe}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 📂 SECCIÓN DE DOCUMENTOS ADJUNTOS          */}
      {/* ========================================== */}
      <div className="glass rounded-2xl p-6 md:p-8 border border-white/10">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span>📎</span> Expediente Digital
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* 🛡️ Documentos Comunes */}
          <TarjetaDocumento titulo="Identificación Oficial" url={inversionista.doc_identificacion} />
          <TarjetaDocumento titulo="Constancia Fiscal" url={inversionista.doc_constancia_fiscal} />
          <TarjetaDocumento titulo="Comprobante de Domicilio" url={inversionista.doc_comprobante_domicilio} />
          <TarjetaDocumento titulo="Carátula Bancaria" url={inversionista.doc_cuenta_banco} />

          {/* 🏢 Documentos Exclusivos (Persona Moral) */}
          {inversionista.tipo_inversionista === 'Moral' && (
            <>
              <TarjetaDocumento titulo="Acta Constitutiva" url={inversionista.doc_acta_constitutiva} />
              <TarjetaDocumento titulo="Poder Legal" url={inversionista.doc_poder_legal} />
            </>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* SECCIÓN DE HISTORIAL DE CAMBIOS (AUDITORÍA) */}
      {/* ========================================== */}
      <div className="mt-8 bg-black/40 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-cyan-500/10 rounded-xl">
            <History className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Historial de Modificaciones</h2>
            <p className="text-sm text-gray-400">Registro de seguridad de los cambios realizados en tu cuenta.</p>
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No se han registrado modificaciones en tu perfil.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-sm">
                  <th className="py-3 px-4 font-medium">Fecha y Hora</th>
                  <th className="py-3 px-4 font-medium">Modificado Por</th>
                  <th className="py-3 px-4 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => {
                  // Formatear la fecha
                  const fecha = new Date(log.created_at).toLocaleString('es-MX', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  });
                  
                  // Identificar quién lo hizo
                  const esInversionista = log.usuario_rol === 'INVERSIONISTA';

                  return (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-sm text-gray-300">{fecha}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          esInversionista ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {esInversionista ? <User className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                          {esInversionista ? 'Tú (Desde el Portal)' : 'Administración / Soporte'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setLogSeleccionado(log)}
                          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MINI-MODAL PARA VER LOS DETALLES EXACTOS */}
      {/* ========================================== */}
      {logSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                Detalles del Cambio
              </h3>
              <button 
                onClick={() => setLogSeleccionado(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <ul className="space-y-3">
                {/* Extraemos el array de "detalles" que guardamos en la BD */}
                {logSeleccionado.cambios_realizados?.detalles?.map((cambio, idx) => {
                  // Dividimos el texto "Nombre: de X a Y" para pintarlo bonito
                  const [etiqueta, valor] = cambio.split(': de');
                  return (
                    <li key={idx} className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <span className="block text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">
                        {etiqueta}
                      </span>
                      <span className="text-sm text-gray-300">
                        {valor ? `Cambió de ${valor}` : cambio}
                      </span>
                    </li>
                  );
                })}
                
                {(!logSeleccionado.cambios_realizados?.detalles || logSeleccionado.cambios_realizados.detalles.length === 0) && (
                  <li className="text-gray-400 text-sm text-center">No se registraron campos específicos en este cambio.</li>
                )}
              </ul>
            </div>
            
            <div className="p-4 bg-black/20 border-t border-white/10 text-right">
              <button 
                onClick={() => setLogSeleccionado(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      <ModalNuevoInversionista 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)}
        inversionistaAEditar={inversionista} 
        
        // 🚀 AHORA SÍ: Conectado al Radar en Tiempo Real del Inversionista
        onCheckDuplicado={async (campo, valor) => {
          try {
            const res = await inversionistaService.verificarDuplicado(campo, valor);
            return { existe: res.existe };
          } catch(e) {
            return { existe: false };
          }
        }} 

        onSave={async (data) => {
          try {
            const response = await inversionistaService.updateMiPerfil(data);
            if (response.success) {
              alert('✅ Perfil actualizado exitosamente');
              setShowEditModal(false);
              // Recargamos los datos para que la vista se actualice
              window.location.reload(); 
            } else {
              alert(`⛔ Error: ${response.message}`);
            }
          } catch (error) {
            console.error("Error al editar:", error);
            alert(`❌ Error al guardar los cambios: ${error.message}`);
          }
        }} 
      />
    </div>
  );
};

export default InversionistaPerfil;