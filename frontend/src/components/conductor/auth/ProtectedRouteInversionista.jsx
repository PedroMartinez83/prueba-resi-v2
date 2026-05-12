// frontend/src/components/inversionista/auth/ProtectedRouteInversionista.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext'; // Ajusta la ruta a tu AuthContext

const ProtectedRouteInversionista = () => {
  const { user, loading } = useAuth();

  console.log('🔍 ProtectedRouteInversionista - user:', user);

  // 1. Mientras carga, mostrar pantalla de carga (Con temática verde/financiera)
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="text-emerald-400 mt-4 font-medium">Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  // 2. Si no está autenticado, redirigir al login EXCLUSIVO de inversionistas
  if (!user) {
    console.log('❌ No hay usuario autenticado, redirigiendo a /inversionista/login');
    return <Navigate to="/inversionista/login" replace />;
  }

  // 3. Verificar que sea inversionista o admin superior
  // Ajusta estos roles según como los tengas en tu base de datos
  const rolesPermitidos = ['inversionista', 'super_admin', 'direccion'];
  const tieneAcceso = rolesPermitidos.includes(user.rol);

  if (!tieneAcceso) {
    console.log('❌ Usuario no tiene rol de inversionista:', user.rol);
    return <Navigate to="/inversionista/login" replace />;
  }

  // 4. Si es inversionista, verificar que tenga su ID de inversionista en la BD
  // (Esto es vital para que luego puedas hacer la consulta de SUS contratos)
  if (user.rol === 'inversionista' && !user.inversionistaId) {
    console.error('❌ Usuario inversionista sin inversionistaId:', user);
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-red-400 mb-3">Cuenta Incompleta</h2>
          <p className="text-gray-300">
            Tu usuario no está vinculado a un portafolio de inversión. Por favor, contacta a tu asesor o al administrador de AutoManager.
          </p>
        </div>
      </div>
    );
  }

  console.log('✅ Acceso permitido al portal inversionista:', {
    email: user.email,
    rol: user.rol,
    inversionistaId: user.inversionistaId
  });

  // 5. Todo OK, levantar la pluma y dejarlo pasar a las rutas protegidas
  return <Outlet />;
};

export default ProtectedRouteInversionista;