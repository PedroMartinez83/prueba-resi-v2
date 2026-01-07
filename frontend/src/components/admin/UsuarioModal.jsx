// frontend/src/components/admin/UsuarioModal.jsx
import React, { useState, useEffect } from 'react';
import { X, User, Mail, Shield, AlertCircle } from 'lucide-react';

const ROL_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin', description: 'Control total del sistema' },
  { value: 'director', label: 'Director', description: 'Vista total y decisiones' },
  { value: 'gerente_ops', label: 'Gerente Operaciones', description: 'Gestión flota y conductores' },
  { value: 'contador', label: 'Contador', description: 'Finanzas y pagos' },
  { value: 'reclutador', label: 'Reclutador', description: 'Captación de conductores' },
  { value: 'jefe_taller', label: 'Jefe de Taller', description: 'Mantenimiento' },
  { value: 'secretaria', label: 'Secretaria', description: 'Solicitudes y pagos' }
];

const ESTADO_OPTIONS = [
  { value: 'Activo', label: 'Activo', description: 'Usuario puede acceder normalmente' },
  { value: 'suspendido', label: 'Suspendido', description: 'Acceso temporalmente bloqueado' },
  { value: 'prohibido', label: 'Prohibido', description: 'Acceso permanentemente bloqueado' }
];

const UsuarioModal = ({ usuario, onClose, onGuardar }) => {
  const [formData, setFormData] = useState({
    email: '',
    nombre_completo: '',
    rol: 'conductor',
    estado_cuenta: 'Activo'
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = currentUser.rol === 'super_admin';
  const isDirector = currentUser.rol === 'director';
  const isEditing = !!usuario;

  useEffect(() => {
    if (usuario) {
      setFormData({
        email: usuario.email || '',
        nombre_completo: usuario.nombre_completo || '',
        rol: usuario.rol || 'conductor',
        estado_cuenta: usuario.estado_cuenta || 'Activo'
      });
    }
  }, [usuario]);

  const validateForm = () => {
    const newErrors = {};

    // Validar email
    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    // Validar nombre
    if (!formData.nombre_completo.trim()) {
      newErrors.nombre_completo = 'El nombre completo es obligatorio';
    } else if (formData.nombre_completo.trim().length < 3) {
      newErrors.nombre_completo = 'El nombre debe tener al menos 3 caracteres';
    }

    // Validar rol
    if (!formData.rol) {
      newErrors.rol = 'Debes seleccionar un rol';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onGuardar(formData);
    } catch (error) {
      console.error('Error al guardar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 rounded-2xl max-w-2xl w-full border border-white/20 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <User className="w-6 h-6 text-cyan-400" />
              {isEditing ? 'Editar Usuario' : 'Crear Usuario'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {isEditing ? 'Modifica los datos del usuario' : 'Completa todos los campos obligatorios'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isEditing} // Email no se puede cambiar en edición
                className={`w-full pl-10 pr-4 py-3 bg-black/40 border ${errors.email ? 'border-red-500/50' : 'border-white/10'} rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                placeholder="usuario@ejemplo.com"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.email}
              </p>
            )}
            {isEditing && (
              <p className="mt-1 text-xs text-gray-500">
                El email no se puede modificar
              </p>
            )}
          </div>

          {/* Nombre Completo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre Completo *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="nombre_completo"
                value={formData.nombre_completo}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-3 bg-black/40 border ${errors.nombre_completo ? 'border-red-500/50' : 'border-white/10'} rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all`}
                placeholder="Juan Pérez García"
              />
            </div>
            {errors.nombre_completo && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.nombre_completo}
              </p>
            )}
          </div>

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Rol * {!isSuperAdmin && <span className="text-xs text-gray-500">(Solo Super Admin puede cambiar roles)</span>}
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-3.5 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                name="rol"
                value={formData.rol}
                onChange={handleChange}
                disabled={!isSuperAdmin}
                className={`w-full pl-10 pr-4 py-3 bg-black/40 border ${errors.rol ? 'border-red-500/50' : 'border-white/10'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all ${!isSuperAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {ROL_OPTIONS.map(rol => (
                  <option key={rol.value} value={rol.value}>
                    {rol.label} - {rol.description}
                  </option>
                ))}
              </select>
            </div>
            {errors.rol && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.rol}
              </p>
            )}
          </div>

          {/* Estado (Solo en edición) */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Estado de Cuenta *
              </label>
              <select
                name="estado_cuenta"
                value={formData.estado_cuenta}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-black/40 border ${errors.estado_cuenta ? 'border-red-500/50' : 'border-white/10'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all`}
              >
                {ESTADO_OPTIONS.map(estado => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label} - {estado.description}
                  </option>
                ))}
              </select>
              {errors.estado_cuenta && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.estado_cuenta}
                </p>
              )}
            </div>
          )}

          {/* Info box */}
          {!isEditing && (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-cyan-400 font-medium mb-1">
                    Contraseña Temporal
                  </p>
                  <p className="text-xs text-cyan-300/80">
                    Se generará automáticamente una contraseña temporal que deberás compartir con el usuario. 
                    El usuario deberá cambiarla en su primer inicio de sesión.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : isEditing ? 'Actualizar Usuario' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UsuarioModal;
