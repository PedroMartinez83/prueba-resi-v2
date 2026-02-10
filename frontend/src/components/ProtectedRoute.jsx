// frontend/src/components/ProtectedRoute.jsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Definir adminRoles
const adminRoles = ['admin', 'super_admin', 'director', 'gerente_ops', 'finanzas', 'gestor_flota', 'secretaria'];

// Función para verificar acceso según roles
const checkRoleAccess = (userRole, requiredRole, allowedRoles) => {
  // Si se proporciona allowedRoles (array), verificar si el usuario tiene alguno de esos roles
  if (allowedRoles && Array.isArray(allowedRoles)) {
    return allowedRoles.includes(userRole);
  }
  
  // Si la ruta requiere 'admin' y el usuario tiene cualquier rol administrativo
  if (requiredRole === 'admin' && adminRoles.includes(userRole)) {
    return true;
  }
  
  // Para otros casos, comparación exacta
  if (requiredRole) {
    return userRole === requiredRole;
  }
  
  // Si no hay restricción de rol, permitir acceso
  return true;
};

const ProtectedRoute = ({ children, requiredRole = null, allowedRoles = null }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark to-primary/20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.rol || user?.role;
  
  // Verificación mejorada de roles
  if ((requiredRole || allowedRoles) && !checkRoleAccess(userRole, requiredRole, allowedRoles)) {
    // Redirigir según el rol del usuario
    if (adminRoles.includes(userRole)) {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (userRole === 'conductor') {
      return <Navigate to="/conductor/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
