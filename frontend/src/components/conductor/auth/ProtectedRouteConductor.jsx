// frontend/src/components/conductor/auth/ProtectedRouteConductor.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

const ProtectedRouteConductor = () => {
  const { user, loading } = useAuth();

  console.log('🔍 ProtectedRouteConductor - user:', user);
  console.log('🔍 ProtectedRouteConductor - loading:', loading);

  // Mientras carga, mostrar pantalla de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-white mt-4">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, redirigir al login del conductor
  if (!user) {
    console.log('❌ No hay usuario autenticado, redirigiendo a /conductor/login');
    return <Navigate to="/conductor/login" replace />;
  }

  // Verificar que sea conductor o admin
  const rolesPermitidos = ['conductor', 'super_admin', 'direccion', 'gerente_ops'];
  const tieneAcceso = rolesPermitidos.includes(user.rol);

  if (!tieneAcceso) {
    console.log('❌ Usuario no tiene rol de conductor:', user.rol);
    return <Navigate to="/conductor/login" replace />;
  }

  // Si es conductor, verificar que tenga conductorId
  if (user.rol === 'conductor' && !user.conductorId) {
    console.error('❌ Usuario conductor sin conductorId:', user);
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error de Configuración</h2>
          <p className="text-gray-300">
            Tu usuario no está vinculado a un conductor. Por favor contacta al administrador.
          </p>
        </div>
      </div>
    );
  }

  console.log('✅ Acceso permitido al portal conductor:', {
    email: user.email,
    rol: user.rol,
    conductorId: user.conductorId
  });

  // Todo OK, renderizar las rutas protegidas
  return <Outlet />;
};

export default ProtectedRouteConductor;
