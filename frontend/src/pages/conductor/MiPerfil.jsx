// frontend/src/pages/conductor/MiPerfil.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import conductorService from '../../services/conductorService';
import { 
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Lock,
  Edit,
  Save,
  X,
  ArrowLeft,
  RefreshCw,
  FileText,
  CreditCard,
  Shield,
  Award
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount || 0);
};

const MiPerfil = () => {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados de edición
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [numeroTelefono, setNumeroTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendoDocumentos, setSubiendoDocumentos] = useState({});
  
  // Cambio de contraseña
  const [mostrarCambioPassword, setMostrarCambioPassword] = useState(false);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  useEffect(() => {
    cargarPerfil();
  }, []);

  const cargarPerfil = async () => {
    try {
      setLoading(true);
      const data = await conductorService.getMiPerfil();
      setPerfil(data.perfil || data);
      setNumeroTelefono(data.perfil?.numero_telefono || data.numero_telefono || '');
      setDireccion(data.perfil?.direccion || data.direccion || '');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarPerfil = async () => {
    try {
      setGuardando(true);
      await conductorService.actualizarPerfil({
        numero_telefono: numeroTelefono,
        direccion: direccion
      });
      toast.success('Perfil actualizado correctamente');
      setEditandoPerfil(false);
      cargarPerfil();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const documentosConfig = [
    { tipo: 'ine_frente', titulo: 'INE (Frente)', campo: 'url_ine_frente' },
    { tipo: 'ine_reverso', titulo: 'INE (Reverso)', campo: 'url_ine_reverso' },
    { tipo: 'licencia_frente', titulo: 'Licencia (Frente)', campo: 'url_licencia_frente' },
    { tipo: 'licencia_reverso', titulo: 'Licencia (Reverso)', campo: 'url_licencia_reverso' },
    { tipo: 'comprobante_domicilio', titulo: 'Comprobante de Domicilio', campo: 'url_comprobante_domicilio' }
  ];

  const handleSubirDocumento = async (tipo, archivo, inputElement) => {
    if (!archivo) return;

    try {
      setSubiendoDocumentos((prev) => ({ ...prev, [tipo]: true }));
      const formData = new FormData();
      formData.append('tipo_documento', tipo);
      formData.append('archivo', archivo);

      const response = await conductorService.subirDocumento(formData);
      const urlActualizada = response?.documento?.url;

      if (urlActualizada) {
        const documentoConfig = documentosConfig.find((doc) => doc.tipo === tipo);
        const campoActualizar = documentoConfig?.campo;

        if (campoActualizar) {
          setPerfil((prev) => ({
            ...prev,
            [campoActualizar]: urlActualizada
          }));
        }
      }

      toast.success('Documento subido correctamente');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubiendoDocumentos((prev) => ({ ...prev, [tipo]: false }));
      if (inputElement) {
        inputElement.value = '';
      }
    }
  };

  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    
    if (passwordNueva !== passwordConfirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (passwordNueva.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setCambiandoPassword(true);
      await conductorService.cambiarPassword({
        password_actual: passwordActual,
        password_nueva: passwordNueva
      });
      toast.success('Contraseña actualizada correctamente');
      setMostrarCambioPassword(false);
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordConfirm('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCambiandoPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="text-center py-12">
        <User className="w-20 h-20 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400">No se pudo cargar el perfil</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/conductor/dashboard')}
          className="p-2 hover:bg-white/10 rounded-lg transition-all"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">Mi Perfil</h1>
          <p className="text-gray-400">Información personal y configuración</p>
        </div>
      </div>

      {/* Tarjeta Principal de Perfil */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {perfil.nombre_conductor?.charAt(0) || 'C'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{perfil.nombre_conductor}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Award className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-semibold">{perfil.categoria || 'Oro'}</span>
              </div>
            </div>
          </div>

          {!editandoPerfil && (
            <button
              onClick={() => setEditandoPerfil(true)}
              className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Editar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Mail className="w-4 h-4" />
              Correo Electrónico
            </label>
            <p className="text-white font-medium">{perfil.email || 'N/A'}</p>
          </div>

          {/* Teléfono */}
          <div>
            <label className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Phone className="w-4 h-4" />
              Teléfono
            </label>
            {editandoPerfil ? (
              <input
                type="tel"
                value={numeroTelefono}
                onChange={(e) => setNumeroTelefono(e.target.value)}
                className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
                placeholder="Ej: 3331234567"
              />
            ) : (
              <p className="text-white font-medium">{perfil.numero_telefono || 'No registrado'}</p>
            )}
          </div>

          {/* Dirección */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <MapPin className="w-4 h-4" />
              Dirección
            </label>
            {editandoPerfil ? (
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
                placeholder="Ej: Calle 123, Colonia Centro, Tepic"
              />
            ) : (
              <p className="text-white font-medium">{perfil.direccion || 'No registrada'}</p>
            )}
          </div>

          {/* Fecha de Ingreso */}
          <div>
            <label className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Calendar className="w-4 h-4" />
              Fecha de Ingreso
            </label>
            <p className="text-white font-medium">
              {perfil.fecha_ingreso 
                ? new Date(perfil.fecha_ingreso).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
                : 'N/A'}
            </p>
          </div>

          {/* Estado */}
          <div>
            <label className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Shield className="w-4 h-4" />
              Estado
            </label>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
              perfil.status === 'Aprobado' 
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {perfil.status}
            </span>
          </div>

        </div>

        {/* Botones de Acción (Modo Edición) */}
        {editandoPerfil && (
          <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
            <button
              onClick={handleGuardarPerfil}
              disabled={guardando}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {guardando ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Cambios
                </>
              )}
            </button>
            <button
              onClick={() => {
                setEditandoPerfil(false);
                setNumeroTelefono(perfil.numero_telefono || '');
                setDireccion(perfil.direccion || '');
              }}
              className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Información Financiera */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Póliza */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-bold text-white">Mi Póliza</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-gray-400 text-sm">Tipo de Póliza</p>
              <p className="text-white font-semibold">{perfil.tipo_poliza || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Saldo Disponible</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(perfil.saldo_poliza_mecanica)}
              </p>
            </div>
          </div>
        </div>

        {/* Saldos y Ahorro */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Mis Fondos</h3>
          </div>
          
          <div className="space-y-5">

            {/* 2. Póliza Mecánica (Del Vehículo Actual) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <p className="text-gray-400 text-sm">Fondo de Póliza Mecánica</p>
                {/* Mostramos el número de unidad si el backend lo mandó */}
                {perfil.vehiculo_actual && perfil.vehiculo_actual !== 'Sin vehículo asignado' && (
                  <span className="text-[10px] bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/50 uppercase tracking-wider">
                    Unidad {perfil.vehiculo_actual}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {formatCurrency(perfil.saldo_poliza || 0)}
              </p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                * Este fondo pertenece al vehículo asignado y se usa para reparaciones mayores autorizadas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehículo Asignado */}
      {perfil.vehiculo_asignado && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Vehículo Asignado</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InfoItem label="Número Económico" value={perfil.vehiculo_asignado.numero_vehiculo} />
            <InfoItem label="Marca y Modelo" value={`${perfil.vehiculo_asignado.marca} ${perfil.vehiculo_asignado.modelo}`} />
            <InfoItem label="Placa" value={perfil.vehiculo_asignado.placa} />
            <InfoItem 
              label="Ver Más" 
              value={
                <button
                  onClick={() => navigate('/conductor/vehiculo')}
                  className="text-cyan-400 hover:text-cyan-300 text-sm"
                >
                  Ir a Mi Vehículo →
                </button>
              } 
            />
          </div>
        </div>
      )}

      {/* Documentos */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-6 h-6 text-cyan-400" />
          <div>
            <h3 className="text-xl font-bold text-white">Mis Documentos</h3>
            <p className="text-sm text-gray-400">
              {editandoPerfil ? 'Sube tus archivos desde aquí.' : 'Activa edición para subir documentos.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documentosConfig.map((documento) => (
            <DocumentoItem
              key={documento.tipo}
              titulo={documento.titulo}
              url={perfil[documento.campo]}
              editando={editandoPerfil}
              inputId={`documento-${documento.tipo}`}
              cargando={Boolean(subiendoDocumentos[documento.tipo])}
              onUpload={(archivo, inputElement) => handleSubirDocumento(documento.tipo, archivo, inputElement)}
            />
          ))}
          {perfil.fecha_vencimiento_licencia && (
            <div className="md:col-span-2">
              <p className="text-gray-400 text-sm">Vencimiento de Licencia</p>
              <p className="text-white font-medium">
                {new Date(perfil.fecha_vencimiento_licencia).toLocaleDateString('es-MX')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Seguridad - Cambiar Contraseña */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-red-400" />
            <h3 className="text-xl font-bold text-white">Seguridad</h3>
          </div>
          {!mostrarCambioPassword && (
            <button
              onClick={() => setMostrarCambioPassword(true)}
              className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
            >
              Cambiar Contraseña
            </button>
          )}
        </div>

        {mostrarCambioPassword && (
          <form onSubmit={handleCambiarPassword} className="space-y-4">
            <div>
              <label className="block text-white text-sm mb-2">Contraseña Actual</label>
              <input
                type="password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
                required
              />
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Nueva Contraseña</label>
              <input
                type="password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={cambiandoPassword}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
              >
                {cambiandoPassword ? 'Cambiando...' : 'Actualizar Contraseña'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarCambioPassword(false);
                  setPasswordActual('');
                  setPasswordNueva('');
                  setPasswordConfirm('');
                }}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
};

// Componentes auxiliares
const InfoItem = ({ label, value }) => (
  <div>
    <p className="text-gray-400 text-sm">{label}</p>
    <p className="text-white font-medium">{value || 'N/A'}</p>
  </div>
);

const DocumentoItem = ({ titulo, url, editando, inputId, cargando, onUpload }) => (
  <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-white text-sm">{titulo}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 text-sm"
        >
          Ver
        </a>
      ) : (
        <span className="text-gray-500 text-sm">Sin documento</span>
      )}
    </div>
    {editando && (
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all ${
            cargando
              ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
              : 'bg-white/10 border-white/20 text-white hover:bg-white/20 cursor-pointer'
          }`}
        >
          {cargando ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Subir archivo
            </>
          )}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,application/pdf"
          className="hidden"
          disabled={cargando}
          onChange={(event) => onUpload(event.target.files?.[0], event.target)}
        />
        <span className="text-xs text-gray-400">Formatos: JPG, JPEG, PNG, WEBP, HEIC/HEIF, PDF.</span>
      </div>
    )}
  </div>
);

export default MiPerfil;
