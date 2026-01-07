import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, Bot, Trash2, DollarSign, X, MessageSquare, 
  User, Car, ChevronRight, Shield, TrendingUp 
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';
// Asegúrate de importar tu servicio de API si lo usas, o fetch directo

const AuroraChat = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [mensajes, setMensajes] = useState([
    { 
      emisor: 'aurora', 
      tipo: 'texto', 
      contenido: 'Hola, soy Aurora 🤖. Puedo buscar conductores, vehículos o reportes financieros. ¿Qué necesitas?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, isOpen]);

  // 1. Interpretar Intención (Frontend Básico para UX rápida)
  const interpretarIntencion = (texto) => {
    const t = texto.toLowerCase();
    if (t.includes('limpiar') || t.includes('borrar')) return { comando: 'limpiar_solicitudes', parametros: { dias: 30 } };
    if (t.includes('dinero') || t.includes('balance') || t.includes('finanzas')) return { comando: 'ver_balance_global', parametros: {} };
    if (t.includes('estado') || t.includes('flota')) return { comando: 'estado_flota', parametros: {} };
    
    // Default: Asumir búsqueda si no es comando
    return { comando: 'buscar_universal', parametros: { query: t } };
  };

  // 2. Enviar mensaje
  const enviarMensaje = async (textoOverride = null) => {
    const texto = textoOverride || input;
    if (!texto.trim()) return;

    // Mostrar mensaje del usuario
    const nuevoMensajeUsuario = { emisor: 'usuario', tipo: 'texto', contenido: texto };
    setMensajes(prev => [...prev, nuevoMensajeUsuario]);
    setInput('');
    setLoading(true);

    const intencion = interpretarIntencion(texto);

    try {
      const token = localStorage.getItem('token');
      // Ajusta la URL según tu configuración
      const response = await fetch(`${API_BASE_URL}/admin/aurora`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(intencion)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMensajes(prev => [...prev, { 
          emisor: 'aurora', 
          tipo: data.aurora.tipo, 
          contenido: data.aurora.data,
          link: data.aurora.link 
        }]);
      } else {
         setMensajes(prev => [...prev, { emisor: 'aurora', tipo: 'error', contenido: data.mensaje }]);
      }

    } catch (error) {
      console.error(error);
      setMensajes(prev => [...prev, { emisor: 'aurora', tipo: 'error', contenido: "Error de conexión con el servidor." }]);
    } finally {
      setLoading(false);
    }
  };

  // Renderizado de Tarjetas Inteligentes
  const renderContenido = (msg) => {
    if (msg.tipo === 'texto') return <p>{msg.contenido}</p>;
    if (msg.tipo === 'error') return <p className="text-red-300">⛔ {msg.contenido}</p>;

    // --- TARJETA CONDUCTOR ---
    if (msg.tipo === 'tarjeta_conductor') {
      const c = msg.contenido;
      return (
        <div className="bg-white/10 border border-white/10 rounded-lg p-3 mt-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold text-xs">
              {c.nombre.charAt(0)}
            </div>
            <div>
              <p className="text-white font-bold text-sm">{c.nombre}</p>
              <p className="text-cyan-400 text-[10px] uppercase">{c.hallazgo}</p>
            </div>
          </div>
          <div className="space-y-1 text-xs text-gray-300 mb-3">
            <p>📞 {c.telefono}</p>
            <p>🚗 {c.vehiculo_asignado}</p>
            <p>🛡️ Póliza: ${c.saldo_poliza?.toLocaleString()}</p>
          </div>
          <button 
            onClick={() => { setIsOpen(false); navigate(`/admin/conductores/${c.id}`); }}
            className="w-full py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded text-xs border border-primary/30 flex items-center justify-center gap-1"
          >
            Ver Perfil <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      );
    }

    // --- TARJETA FINANCIERA ---
    if (msg.tipo === 'tarjeta_financiera') {
      const f = msg.contenido;
      return (
        <div className="bg-white/10 border border-green-500/30 rounded-lg p-3 mt-1">
          <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-1">
            <DollarSign className="w-4 h-4 text-green-400" />
            <p className="text-green-400 font-bold text-sm">Balance del Mes</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div>
              <p className="text-gray-400">Renta (Empresa)</p>
              <p className="text-white font-mono font-bold">${f.cobrado_mes?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400">Pólizas (Cond.)</p>
              <p className="text-white font-mono font-bold">${f.total_ahorrado_poliza?.toLocaleString()}</p>
            </div>
          </div>
           {f.conductores_morosos > 0 && (
            <div className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-[10px] text-center">
              ⚠️ {f.conductores_morosos} conductores con deuda
            </div>
          )}
        </div>
      );
    }

    return <p>{JSON.stringify(msg.contenido)}</p>; // Fallback
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end font-sans">
      
      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="glass border border-white/10 rounded-2xl w-[350px] h-[500px] flex flex-col shadow-2xl mb-4 animate-fade-in-up overflow-hidden bg-gray-900/95">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/80 to-blue-900/80">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-full relative">
                <Bot className="w-5 h-5 text-cyan-400" />
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-gray-900"></span>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Aurora AI</h3>
                <p className="text-[10px] text-cyan-300 opacity-80">by Lázaro Marketing</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4" ref={scrollRef}>
            {mensajes.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.emisor === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm shadow-sm ${
                  msg.emisor === 'usuario' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white/10 text-gray-200 rounded-bl-none border border-white/5'
                }`}>
                  {renderContenido(msg)}
                  
                  {/* Link opcional en respuestas de texto */}
                  {msg.link && (
                     <button 
                        onClick={() => { setIsOpen(false); navigate(msg.link); }}
                        className="mt-2 text-cyan-400 underline text-xs hover:text-cyan-300"
                      >
                        Ver detalles →
                      </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-gray-500 text-xs ml-4 animate-pulse">
                <Bot className="w-3 h-3" />
                <span>Procesando...</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="p-2 flex gap-2 overflow-x-auto border-t border-white/10 bg-black/20 no-scrollbar">
             <button onClick={() => enviarMensaje('ver finanzas')} className="flex-shrink-0 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 border border-white/5 transition-colors flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-green-400" /> Finanzas
            </button>
            <button onClick={() => enviarMensaje('estado flota')} className="flex-shrink-0 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 border border-white/5 transition-colors flex items-center gap-1">
              <Car className="w-3 h-3 text-blue-400" /> Flota
            </button>
            <button onClick={() => enviarMensaje('limpiar solicitudes')} className="flex-shrink-0 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 border border-white/5 transition-colors flex items-center gap-1">
              <Trash2 className="w-3 h-3 text-red-400" /> Limpiar
            </button>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10 bg-gray-900 flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-cyan-500 focus:outline-none placeholder-gray-600"
              placeholder="Busca un conductor, vehículo..."
              disabled={loading}
            />
            <button 
              onClick={() => enviarMensaje()} 
              disabled={loading || !input.trim()}
              className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          
          <div className="bg-black py-1 text-center">
            <span className="text-[9px] text-gray-600">Propiedad de Lázaro Marketing</span>
          </div>
        </div>
      )}

      {/* BUTTON TRIGGER */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:scale-110 transition-all duration-300 border-2 border-white/10"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
      </button>
    </div>
  );
};

export default AuroraChat;
