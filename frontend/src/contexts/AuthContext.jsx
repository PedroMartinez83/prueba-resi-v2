// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import API from '../services/api';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Verificar si hay un usuario logueado al cargar
  useEffect(() => {
    const checkAuth = () => {
      console.log('🔍 Verificando autenticación...');
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      console.log('Token:', token ? 'Existe' : 'No existe');
      console.log('User guardado:', savedUser);
      
      if (token && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          console.log('✅ Usuario cargado del localStorage:', userData);
          
          // Normalizar rol/role
          if (userData.rol && !userData.role) {
            userData.role = userData.rol;
          }
          
          setUser(userData);
          setIsAuthenticated(true);
        } catch (e) {
          console.error('❌ Error parsing user data:', e);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        console.log('❌ No hay token o user en localStorage');
        setUser(null);
        setIsAuthenticated(false);
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  // Función de login
  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      
      console.log('🔐 Intentando login...');
      const response = await API.post('/auth/login', { email, password });
      const { token, user: userData } = response.data;
      
      console.log('✅ Login exitoso:', userData);
      
      // Normalizar rol/role para compatibilidad
      if (userData.rol && !userData.role) {
        userData.role = userData.rol;
      }
      
      // Guardar en localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      console.log('💾 Usuario guardado en localStorage');
      
      // Actualizar estado
      setUser(userData);
      setIsAuthenticated(true);
      setLoading(false);
      
      // Redirigir según rol
      if (userData.rol === 'conductor') {
        window.location.href = '/conductor/dashboard';
      } else {
        window.location.href = '/admin/dashboard';
      }
      
      return { success: true, user: userData };
    } catch (err) {
     const message =
        err.response?.status === 401
          ? 'Correo o contraseña incorrectos'
          : err.response?.data?.error || err.response?.data?.message || 'Error al iniciar sesión';

    await new Promise(resolve => setTimeout(resolve, 500));

      setError(message);
      setLoading(false);
      setIsAuthenticated(false);
       return {
        success: false,
        error: message,
      };
    }
  };

  // Función de logout
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  // Verificar roles
  const isAdmin = () => {
    const userRole = user?.role || user?.rol;
    return ['admin', 'super_admin', 'director', 'gerente_ops', 'contador', 'secretaria'].includes(userRole);
  };

  const isConductor = () => {
    const userRole = user?.role || user?.rol;
    return userRole === 'conductor';
  };

  const isContador = () => {
    const userRole = user?.role || user?.rol;
    return userRole === 'contador';
  };

  const isGestorFlota = () => {
    const userRole = user?.role || user?.rol;
    return userRole === 'gestor_flota';
  };

  const hasRole = (roles) => {
    const userRole = user?.role || user?.rol;
    if (Array.isArray(roles)) {
      return roles.includes(userRole);
    }
    return userRole === roles;
  };

  const value = {
    user,
    login,
    logout,
    loading,
    error,
    isAdmin,
    isConductor,
    isContador,
    isGestorFlota,
    hasRole,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
