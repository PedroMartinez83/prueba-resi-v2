import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, Lock, LogIn, Eye, EyeOff, AlertTriangle, 
  Car, Shield, TrendingUp, Heart, Star, Sparkles,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL } from '../../services/api';

// Frases motivacionales rotativas
const motivationalQuotes = [
  {
    text: "Cada viaje que realizas construye tu futuro",
    author: "Tu éxito está en el camino"
  },
  {
    text: "Eres el corazón de nuestra operación",
    author: "Gracias por tu dedicación"
  },
  {
    text: "Juntos llegamos más lejos",
    author: "Familia AutoManager"
  },
  {
    text: "Tu esfuerzo de hoy es tu recompensa de mañana",
    author: "Sigue adelante"
  },
  {
    text: "No solo conduces un taxi, conduces sueños",
    author: "Tu trabajo importa"
  }
];

// Estadísticas del sistema (pueden ser dinámicas después)
const systemStats = [
  { icon: Car, value: "95+", label: "Vehículos activos" },
  { icon: Star, value: "4.8", label: "Calificación promedio" },
  { icon: TrendingUp, value: "$2.5M+", label: "Pagado a conductores" }
];

const DriverLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentQuote, setCurrentQuote] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Animación de entrada
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Rotación de frases motivacionales
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % motivationalQuotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Credenciales incorrectas');
      }

      // Verificar que sea un conductor
      if (data.user && data.user.rol === 'conductor') {
        // Guardar en localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('✅ Login exitoso, redirigiendo...');
        
        // Usar window.location.href para forzar recarga completa
        // Esto hace que AuthContext lea los datos de localStorage al iniciar
        window.location.href = '/conductor/dashboard';
      } else {
        throw new Error('Este portal es exclusivo para conductores. Si eres administrador, usa el portal de administración.');
      }

    } catch (err) {
      console.error('Error de inicio de sesión:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-slate-950">
      
      {/* Fondo animado con partículas sutiles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Gradiente principal */}
        <div className="absolute inset-0 bg-[#07425E] via-slate-950 to-slate-900" />
        
        {/* Orbes de luz */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
        
        {/* Patrón de puntos sutil */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}
        />
        
        {/* Líneas de carretera decorativas */}
        <svg className="absolute bottom-0 left-0 w-full h-32 opacity-10" preserveAspectRatio="none">
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="2" strokeDasharray="60,30" />
        </svg>
      </div>

      {/* Panel izquierdo - Branding y motivación (oculto en móvil) */}
      <div className={`hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
        
        {/* Header con logo */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Car className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">AutoManager</h1>
              <p className="text-sm text-cyan-400">Portal de Conductores</p>
            </div>
          </div>
        </div>

        {/* Centro - Mensaje principal */}
        <div className="max-w-lg">
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium mb-6">
              <Heart className="w-4 h-4" />
              Bienvenido a tu espacio
            </span>
            
            <h2 className="text-5xl xl:text-6xl font-bold text-white leading-tight mb-6">
              Tu trabajo
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
                hace la diferencia
              </span>
            </h2>
            
            <p className="text-xl text-gray-400 leading-relaxed">
              Más que conductores, somos una familia que construye juntos un mejor futuro. 
              Aquí puedes ver tus rendimientos, registrar pagos y crecer profesionalmente.
            </p>
          </div>

          {/* Frase motivacional rotativa */}
          <div className="relative h-24 mb-8">
            {motivationalQuotes.map((quote, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-700 ${
                  index === currentQuote 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
              >
                <blockquote className="border-l-4 border-cyan-500 pl-6">
                  <p className="text-lg text-gray-300 italic mb-2">"{quote.text}"</p>
                  <footer className="text-sm text-cyan-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {quote.author}
                  </footer>
                </blockquote>
              </div>
            ))}
          </div>

          {/* Indicadores de frase */}
          <div className="flex gap-2 mb-8">
            {motivationalQuotes.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuote(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentQuote 
                    ? 'w-8 bg-cyan-500' 
                    : 'w-3 bg-gray-600 hover:bg-gray-500'
                }`}
              />
            ))}
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-3 gap-6">
            {systemStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div 
                  key={index}
                  className="group p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all duration-300"
                >
                  <Icon className="w-6 h-6 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario de login */}
      <div className={`w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 md:p-12 relative transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
        
        {/* Card de login */}
        <div className="w-full max-w-md">
          
          {/* Logo móvil */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Car className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-white">AutoManager</h1>
                <p className="text-sm text-cyan-400">Portal de Conductores</p>
              </div>
            </div>
          </div>

          {/* Saludo */}
          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              ¡Hola, Conductor! 👋
            </h2>
            <p className="text-gray-400">
              Ingresa tus credenciales para acceder a tu portal
            </p>
          </div>

          {/* Formulario */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Error message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 animate-shake">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 text-sm font-medium">Error de acceso</p>
                    <p className="text-red-400/80 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  Correo Electrónico
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full py-4 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    placeholder="tu.correo@ejemplo.com"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Contraseña
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full py-4 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="relative w-full py-4 flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl overflow-hidden group transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Efecto de brillo en hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Ingresar a mi portal</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Separador */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-slate-900/50 text-gray-500 text-sm">¿Primera vez aquí?</span>
              </div>
            </div>

            {/* Info para nuevos usuarios */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400 font-medium text-sm mb-1">¿No tienes cuenta?</p>
                  <p className="text-gray-400 text-sm">
                    Tu administrador debe crear tu acceso. Contacta a la oficina para obtener tus credenciales.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estilos adicionales para animaciones */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default DriverLogin;
