// frontend/src/services/api.js
import axios from 'axios';

// Configuración base de Axios con detección de entorno y soporte para variables de entorno
export const getApiBaseUrl = () => {
  if (window.location.hostname === '18.221.148.23') {
    return 'http://18.221.148.23:3001/api';
  }
  const envUrl = import.meta.env?.VITE_API_URL;
  if (envUrl) return envUrl;

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const port = typeof window !== 'undefined' ? window.location.port : '';

  // Entornos locales (localhost, IPs privadas o dominios .local)
  const isLocalHost = (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local')
  );

  if (isLocalHost) {
    return `http://${hostname || 'localhost'}:${import.meta.env?.VITE_API_PORT || '3001'}/api`;
  }

  // Producción en dominios oficiales
  if (hostname.includes('driverautomanager.com')) {
    return 'https://api.driverautomanager.com/api';
  }

  // Deploys en plataformas de preview (Vercel/Railway) apuntan a su propio dominio
  if (hostname.includes('vercel.app') || hostname.includes('railway.app')) {
    return `https://${hostname}/api`;
  }

  // Fallback: usar el mismo host (EC2 u otros despliegues sin dominio dedicado)
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const baseHost = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  return `${baseHost}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token a cada request
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const isUnauthorized = error.response?.status === 401;
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (isUnauthorized && !isLoginRequest) {
      // Token expirado o inválido
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;
