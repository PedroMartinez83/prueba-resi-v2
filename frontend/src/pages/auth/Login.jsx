// /pages/auth/Login.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Import de Assets (¡Correcto!)
import videoBg from '@/assets/road-bg.mp4';
import logo from "@/assets/logo.png";

// Import de Contexto y Componentes UI
import { useAuth } from "@/contexts/AuthContext";
import { User, Lock, AlertCircle, Car, Phone, Calendar, ChevronRight, Shield, Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

// Import de Estilos
import './Login.css';

const Login = () => {
  // --- ESTADOS DEL COMPONENTE ---
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Estados para datos de formularios
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehiculosDisponibles, setVehiculosDisponibles] = useState([]);
  const [registroData, setRegistroData] = useState({
    nombre: '',
    telefono: '',
    numeroVehiculo: '',
    tipoSocio: 'SD',
    ineFile: '',
    fotoLicenciaFrente: '',
    licenciaVencimiento: '',
    seguroVencimiento: ''
  });

  // Hooks de React Router y Contexto
  const { login } = useAuth(); // ¡Correcto! Ahora usaremos esta función.
  const navigate = useNavigate();

  // --- MANEJADORES DE EVENTOS Y LÓGICA ---

  // ==================================================================
  // ========= ESTA ES LA ÚNICA FUNCIÓN QUE HA SIDO MODIFICADA =========
  // ==================================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Llama a la función `login` del AuthContext en lugar de usar fetch aquí.
      const result = await login(email, password);

      // 2. Comprueba el resultado que devuelve el contexto.
      if (result.success) {
            console.log('Usuario recibido del backend:', result.user);

        // 3. La lógica de redirección se mantiene aquí, lo cual es perfecto.
        const userRole = result.user.rol || result.user.role || 'conductor';
        
        switch(userRole) {
          case 'super_admin':
          case 'director':
          case 'gerente_ops':
        case 'finanzas':
          case 'gestor_flota':
          case 'admin':
            navigate('/admin/dashboard');
            break;
          case 'conductor':
            navigate('/conductor/dashboard');
            break;
          case 'reclutador':
            navigate('/admin/prospectos');
            break;
          case 'jefe_taller':
            navigate('/admin/mantenimientos');
            break;
          case 'compras':
            navigate('/admin/inventario');
            break;
          default:
            navigate('/dashboard');
        }
      } else {
        // 4. Si hay un error, lo obtenemos de la respuesta del contexto.
        setError(result.error || 'Error al iniciar sesión. Verifica tus credenciales.');
      }
    } catch (error) {
      // Este catch es por si ocurre un error inesperado al llamar a la función `login`
      setError('Ocurrió un error inesperado. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // El resto de las funciones no necesitan cambios
  const cargarVehiculosDisponibles = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/vehiculos-disponibles`);
      const data = await response.json();
      
      if (data.success) {
        setVehiculosDisponibles(data.vehiculos);
      } else {
        setError('No se pudieron cargar los vehículos disponibles.');
      }
    } catch (error) {
      setError('Error de conexión al cargar vehículos.');
    } finally {
      setIsLoading(false);
    }
  };

  const verificarVehiculo = async () => {
    if (!registroData.numeroVehiculo) {
      setError('Por favor, selecciona un vehículo de la lista.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verificar-vehiculo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroVehiculo: registroData.numeroVehiculo })
      });
      const data = await response.json();

      if (data.success) {
        if (data.action === 'login') {
          setError('Este vehículo ya tiene un usuario asignado. Por favor, inicia sesión.');
          setMode('login');
        } else {
          setMode('register');
          setStep(1);
          setError('');
        }
      } else {
        setError(data.message || 'Ocurrió un error al verificar el vehículo.');
      }
    } catch (error) {
      setError('Error de conexión al verificar el vehículo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistro = async () => {
    setIsLoading(true);
    setError('');

    if (!registroData.licenciaVencimiento || !registroData.seguroVencimiento) {
      setError('Las fechas de vencimiento de licencia y seguro son obligatorias.');
      setIsLoading(false);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Para comparar solo la fecha
    if (new Date(registroData.licenciaVencimiento) < today || new Date(registroData.seguroVencimiento) < today) {
      setError('Las fechas de vencimiento no pueden ser en el pasado.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/registrar-por-vehiculo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...registroData
        })
      });

      const data = await response.json();

      if (data.success) {
        setError('¡Registro exitoso! Serás redirigido al inicio de sesión.');
        setTimeout(() => {
          setMode('login');
          setError('');
        }, 2000);
      } else {
        setError(data.message || 'Error durante el registro.');
      }
    } catch (error) {
      setError('Error de conexión durante el registro.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setRegistroData(prev => ({ ...prev, [field]: value }));
  };

  // --- RENDERIZADO DEL COMPONENTE (SIN CAMBIOS) ---
  return (
    <div className="login-container">
      <video autoPlay loop muted className="background-video">
        <source src={videoBg} type="video/mp4" />
      </video>
      <div className="animated-bg">
        <div className="grid-overlay"></div>
        <div className="glow-orb glow-1"></div>
        <div className="glow-orb glow-2"></div>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="floating-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 20}s`
            }}
          />
        ))}
      </div>
      <div className="login-card-container">
        <div className="login-card">
          <div className="card-header">
            <div className="logo-container">
              <img src={logo} alt="Auto Manager" className="logo" />
            </div>
            <h1 className="brand-title">Auto Manager</h1>
            <p className="brand-subtitle">Sistema de Gestión Vehicular</p>
          </div>
          <div className="card-body">
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <div className="input-wrapper">
                    <User className="input-icon" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <div className="input-wrapper">
                    <Lock className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="password-input"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="toggle-icon" /> : <Eye className="toggle-icon" />}
                    </button>
                  </div>
                </div>
                 <div className="form-footer">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => navigate('/forgot-password')}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </button>
                {error && (
                  <div className="alert error-alert">
                    <AlertCircle className="alert-icon" />
                    <span>{error}</span>
                  </div>
                )}
                {/*<div className="divider"><span>o</span></div>
                <button type="button" className="btn-google" onClick={() => alert('Próximamente')}>
                  <svg className="google-icon" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Iniciar con Google
                </button>*/}
                <div className="form-footer">
                 {/* <button type="button" onClick={() => { setMode('check'); cargarVehiculosDisponibles(); }} className="link-button">
                    ¿Eres nuevo? Registrarse con vehículo
                  </button>*/}
                </div>
              </form>
            )}
            {/* El resto del JSX no cambia... */}
          </div>
        </div>
        <div className="login-footer">
          <p className="copyright">© 2025 Auto Manager</p>
          <p className="developer">
            Desarrollado por <span className="developer-brand">somoslazaro.marketing</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
